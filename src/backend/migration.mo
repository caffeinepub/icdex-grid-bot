import List "mo:core/List";
import Nat "mo:core/Nat";

module {
  type OldActor = {
    intervalSeconds : Nat;
    spreadBps : Nat;
    numOrders : Nat;
    isRunning : Bool;
    timerID : ?Nat;
    logs : List.List<Text>;
    activeOrderIds : [Nat];
    lastMidPrice : Nat;
    canisterPrincipalText : Text;
    maxLogs : Nat;
  };

  type NewActor = {
    intervalSeconds : Nat;
    spreadBps : Nat;
    numOrders : Nat;
    isRunning : Bool;
    timerID : ?Nat;
    logs : List.List<Text>;
    activeOrderIds : [Nat];
    lastMidPrice : Nat;
    canisterPrincipalText : Text;
    maxLogs : Nat;
  };

  public func run(old : OldActor) : NewActor {
    old;
  };
};
