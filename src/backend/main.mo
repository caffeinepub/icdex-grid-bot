import List "mo:core/List";
import Text "mo:core/Text";
import Nat "mo:core/Nat";
import Timer "mo:core/Timer";
import Blob "mo:core/Blob";
import Principal "mo:core/Principal";
import Migration "migration";

// Apply migration using with-clause for stable state

(with migration = Migration.run)
actor self {
  // Types matching ICDex interface
  type Level = {
    price : Nat;
    quantity : Nat;
  };

  type Level10 = {
    bids : [Level];
    asks : [Level];
  };

  type OrderSide = { #buy; #sell };
  type OrderType = { #limit; #market; #ioc; #fok };

  type PlaceOrderArgs = {
    side : OrderSide;
    orderType : OrderType;
    price : Nat;
    quantity : Nat;
    expireAt : Nat;
  };

  type TransferArgs = {
    to : {
      owner : Principal;
      subaccount : ?Blob;
    };
    amount : Nat;
  };

  type ApproveArgs = {
    spender : { owner : Principal; subaccount : ?Blob };
    amount : Nat;
  };

  type Balances = {
    icpBalance : Nat;
    ckusdtBalance : Nat;
  };

  // External canister references
  let icdex = actor("jgxow-pqaaa-aaaar-qahaq-cai") : actor {
    getLevel10 : () -> async Level10;
    placeOrder : PlaceOrderArgs -> async Nat;
    cancelOrder : Nat -> async ();
  };

  let icp = actor("ryjl3-tyaaa-aaaaa-aaaba-cai") : actor {
    icrc1_balance_of : { owner : Principal; subaccount : ?Blob } -> async { amount : Nat };
    icrc1_transfer : TransferArgs -> async ();
    icrc2_approve : ApproveArgs -> async ();
  };

  let ckusdt = actor("cngnf-vqaaa-aaaar-qag4q-cai") : actor {
    icrc1_balance_of : { owner : Principal; subaccount : ?Blob } -> async { amount : Nat };
    icrc1_transfer : TransferArgs -> async ();
    icrc2_approve : ApproveArgs -> async ();
  };

  var intervalSeconds : Nat = 60;
  var spreadBps : Nat = 45;
  var numOrders : Nat = 20;
  var isRunning : Bool = false;
  var timerID : ?Timer.TimerId = null;
  var logs = List.empty<Text>();
  var activeOrderIds : [Nat] = [];
  var lastMidPrice : Nat = 0;
  var canisterPrincipalText : Text = "";
  let maxLogs = 2000;

  // Internal log management
  func addLog(message : Text) {
    if (logs.size() >= maxLogs) {
      let lastLog = logs.last();
      logs.clear();
      if (lastLog != null) {
        logs.add(message);
      };
    } else {
      logs.add(message);
    };
  };

  // Main trading loop
  func tradingLoop() : async () {
    if (not isRunning) { return };

    // Fetch Level10 from ICDex
    let level10 : ?Level10 = do {
      try {
        let l10 = await icdex.getLevel10();
        ?l10;
      } catch (_) {
        addLog("Erro ao obter nível 10");
        null;
      };
    };

    switch (level10) {
      case (null) {
        addLog("Nível 10 não disponível");
        return;
      };
      case (?l10) {
        // Calculate mid price
        if (l10.bids.size() == 0 or l10.asks.size() == 0) {
          addLog("Sem liquidez para calcular preço médio");
          return;
        };

        let bestBid : Nat = l10.bids[0].price;
        let bestAsk : Nat = l10.asks[0].price;
        let mid = (bestBid + bestAsk) / 2;
        lastMidPrice := mid;
        addLog("Atualização de preço médio: " # mid.toText());

        let approveArgs : ApproveArgs = {
          spender = {
            owner = Principal.fromText("jgxow-pqaaa-aaaar-qahaq-cai");
            subaccount = null;
          };
          amount = 10_000_000_000;
        };

        try {
          await icp.icrc2_approve(approveArgs);
          await ckusdt.icrc2_approve(approveArgs);
        } catch (_) {
          addLog("Approves ICP/ckUSDT failed. Aborting other actions.");
          return;
        };

        for (orderId in activeOrderIds.values()) {
          try {
            await icdex.cancelOrder(orderId);
            addLog("Índice " # orderId.toText() # " cancelada");
          } catch (_) {
            addLog("Erro cancelando ordem " # orderId.toText());
          };
        };
        activeOrderIds := [];

        let halfOrders = numOrders / 2;
        var newOrderIds : [Nat] = [];

        var i = 0;
        while (i < halfOrders) {
          let buyPrice = mid * (10_000 - (spreadBps * (i + 1))) / 10_000;
          let buyQuantity = 1_000_000_000 / buyPrice;
          let buyOrder : PlaceOrderArgs = {
            side = #buy;
            orderType = #limit;
            price = buyPrice;
            quantity = buyQuantity;
            expireAt = 0;
          };
          try {
            let orderId = await icdex.placeOrder(buyOrder);
            newOrderIds := newOrderIds.concat([orderId]);
            addLog("Ordem BUY " # buyPrice.toText() # " criada com sucesso");
          } catch (_) {
            addLog("Falha de BUY " # buyPrice.toText());
          };

          let sellPrice = mid * (10_000 + (spreadBps * (i + 1))) / 10_000;
          let sellQuantity = 1_000_000_000 / sellPrice;
          let sellOrder : PlaceOrderArgs = {
            side = #sell;
            orderType = #limit;
            price = sellPrice;
            quantity = sellQuantity;
            expireAt = 0;
          };
          try {
            let orderId = await icdex.placeOrder(sellOrder);
            newOrderIds := newOrderIds.concat([orderId]);
            addLog("Ordem SELL " # sellPrice.toText() # " criada com sucesso");
          } catch (_) {
            addLog("Falha SELL " # sellPrice.toText());
          };
          i += 1;
        };
        activeOrderIds := newOrderIds;
      };
    };
  };

  // Public API functions
  public shared ({ caller }) func startBot() : async () {
    if (isRunning) { return };
    isRunning := true;
    addLog("Bot Iniciado");

    timerID := ?Timer.recurringTimer<system>(
      #seconds intervalSeconds,
      tradingLoop
    );
  };

  public shared ({ caller }) func stopBot() : async () {
    switch (timerID) {
      case (null) {};
      case (?id) { Timer.cancelTimer(id) };
    };
    isRunning := false;
    addLog("Bot parado");

    for (orderId in activeOrderIds.values()) {
      try {
        await icdex.cancelOrder(orderId);
        addLog("Índice " # orderId.toText() # " cancelada");
      } catch (_) {
        addLog("Erro cancelando ordem " # orderId.toText());
      };
    };
    activeOrderIds := [];
  };

  public query ({ caller }) func getStatus() : async {
    isRunning : Bool;
    lastMidPrice : Nat;
    activeOrderCount : Nat;
  } {
    {
      isRunning;
      lastMidPrice;
      activeOrderCount = activeOrderIds.size();
    };
  };

  public query ({ caller }) func getConfig() : async {
    numOrders : Nat;
    spreadBps : Nat;
    intervalSeconds : Nat;
  } {
    {
      numOrders;
      spreadBps;
      intervalSeconds;
    };
  };

  public shared ({ caller }) func setConfig(
    newNumOrders : Nat,
    newSpreadBps : Nat,
    newIntervalSeconds : Nat,
  ) : async () {
    if (isRunning) { return };
    numOrders := newNumOrders;
    spreadBps := newSpreadBps;
    intervalSeconds := newIntervalSeconds;
    addLog(
      "Configurações Atualizadas: NumOrders: " # newNumOrders.toText() # ", SpreadBps: " # newSpreadBps.toText() # ", Interval: " # newIntervalSeconds.toText(),
    );
  };

  public query ({ caller }) func getLogs() : async [Text] {
    logs.toArray();
  };

  public query ({ caller }) func getActiveOrders() : async [Nat] {
    activeOrderIds;
  };

  public shared ({ caller }) func clearLogs() : async () {
    logs.clear();
    addLog("Logs limpos!");
  };

  public shared ({ caller }) func getCanisterPrincipal() : async Text {
    canisterPrincipalText;
  };

  public shared ({ caller }) func getBalances() : async Balances {
    {
      icpBalance = await getICPBalance();
      ckusdtBalance = await getCKUSDTBalance();
    };
  };

  // Helper functions for balance retrieval
  func getICPBalance() : async Nat {
    let account = { owner = Principal.fromText(canisterPrincipalText); subaccount = null };
    try {
      let balance = await icp.icrc1_balance_of(account);
      balance.amount;
    } catch (_) { 0 };
  };

  func getCKUSDTBalance() : async Nat {
    let account = { owner = Principal.fromText(canisterPrincipalText); subaccount = null };
    try {
      let balance = await ckusdt.icrc1_balance_of(account);
      balance.amount;
    } catch (_) { 0 };
  };

  public shared ({ caller }) func withdrawICP(amount : Nat, to : Principal) : async () {
    let transferArgs : TransferArgs = {
      to = { owner = to; subaccount = null };
      amount;
    };
    try {
      await icp.icrc1_transfer(transferArgs);
      addLog("ICP saque bem-sucedido: " # amount.toText());
    } catch (_) {
      addLog("Falha no saque de ICP: " # amount.toText());
    };
  };

  public shared ({ caller }) func withdrawCKUSDT(amount : Nat, to : Principal) : async () {
    let transferArgs : TransferArgs = {
      to = { owner = to; subaccount = null };
      amount;
    };
    try {
      await ckusdt.icrc1_transfer(transferArgs);
      addLog("CKUSDT saque bem-sucedido: " # amount.toText());
    } catch (_) {
      addLog("Falha no saque de CKUSDT: " # amount.toText());
    };
  };

  public shared ({ caller }) func initCanisterPrincipal() : async () {
    canisterPrincipalText := Principal.fromActor(self).toText();
    addLog("default anonymous principal initialized: " # canisterPrincipalText);
  };
};
