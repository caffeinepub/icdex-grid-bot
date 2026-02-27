import { useState, useEffect, useRef, useCallback } from "react";
import { useActor } from "./hooks/useActor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Loader2,
  Play,
  Square,
  RotateCcw,
  Settings,
  Terminal,
  Activity,
  ChevronRight,
  Copy,
  Check,
  RefreshCw,
  Wallet,
  ArrowUpRight,
} from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Principal } from "@icp-sdk/core/principal";

// ── Types ──────────────────────────────────────────────────────────────────
interface BotConfig {
  numOrders: number;
  spreadPercent: string; // displayed as "0.45"
  intervalSeconds: number;
}

interface BotStatus {
  isRunning: boolean;
  lastMidPrice: bigint;
  activeOrderCount: bigint;
}

interface Balances {
  icpBalance: bigint;
  ckusdtBalance: bigint;
}

type ActiveTab = "logs" | "saldo";

// ── Helpers ────────────────────────────────────────────────────────────────
function parseLogLine(line: string) {
  const lower = line.toLowerCase();
  if (lower.includes("erro") || lower.includes("error") || lower.includes("falha")) return "error";
  if (lower.includes("buy") || lower.includes("compra")) return "buy";
  if (lower.includes("sell") || lower.includes("venda")) return "sell";
  if (lower.includes("iniciado") || lower.includes("started") || lower.includes("rodando")) return "success";
  if (lower.includes("parado") || lower.includes("stopped")) return "warn";
  if (lower.includes("mid price") || lower.includes("mid:")) return "accent";
  return "default";
}

// ── Status Indicator ───────────────────────────────────────────────────────
function StatusDot({ isRunning }: { isRunning: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <span className="relative flex h-2.5 w-2.5">
        {isRunning ? (
          <>
            <span
              className="animate-pulse-running absolute inline-flex h-full w-full rounded-full"
              style={{ backgroundColor: "oklch(var(--status-running))", opacity: 0.6 }}
            />
            <span
              className="relative inline-flex rounded-full h-2.5 w-2.5"
              style={{ backgroundColor: "oklch(var(--status-running))" }}
            />
          </>
        ) : (
          <span
            className="animate-pulse-stopped inline-flex rounded-full h-2.5 w-2.5"
            style={{ backgroundColor: "oklch(var(--status-stopped))" }}
          />
        )}
      </span>
      <span
        className="text-sm font-mono font-medium tracking-widest uppercase"
        style={{
          color: isRunning
            ? "oklch(var(--status-running))"
            : "oklch(var(--status-stopped))",
        }}
      >
        {isRunning ? "Rodando" : "Parado"}
      </span>
    </span>
  );
}

// ── Log Panel ──────────────────────────────────────────────────────────────
function LogLine({ line, index }: { line: string; index: number }) {
  const kind = parseLogLine(line);

  const colorMap: Record<string, string> = {
    error: "oklch(0.65 0.2 25)",
    buy: "oklch(0.72 0.16 145)",
    sell: "oklch(0.75 0.14 30)",
    success: "oklch(0.75 0.15 145)",
    warn: "oklch(0.70 0.08 80)",
    accent: "oklch(var(--primary))",
    default: "oklch(var(--terminal-text))",
  };

  return (
    <div
      className="log-line-enter flex gap-3 py-0.5 hover:bg-white/[0.025] px-2 rounded transition-colors"
      style={{ animationDelay: `${Math.min(index * 0.01, 0.2)}s` }}
    >
      <span
        className="shrink-0 select-none font-terminal text-xs"
        style={{ color: "oklch(var(--terminal-timestamp))" }}
      >
        ›
      </span>
      <span
        className="font-terminal text-xs break-all leading-relaxed"
        style={{ color: colorMap[kind] }}
      >
        {line}
      </span>
    </div>
  );
}

function LogPanel({
  logs,
}: {
  logs: string[];
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [autoScroll]);

  function handleScroll() {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setAutoScroll(atBottom);
  }

  return (
    <section className="flex flex-col h-full">
      {/* Log area */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto py-2 scanlines"
        style={{
          background: "oklch(var(--terminal-bg))",
          minHeight: 0,
        }}
      >
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 py-12">
            <div
              className="font-terminal text-xs tracking-widest uppercase"
              style={{ color: "oklch(var(--muted-foreground) / 0.4)" }}
            >
              aguardando logs
            </div>
            <div
              className="font-terminal text-xs"
              style={{ color: "oklch(var(--muted-foreground) / 0.25)" }}
            >
              inicie o bot para ver a atividade
            </div>
          </div>
        ) : (
          <div className="px-1">
            {logs.map((line, i) => (
              <LogLine key={`${i}-${line.slice(0, 20)}`} line={line} index={i} />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Bottom bar — auto-scroll follow button */}
      {!autoScroll && (
        <div className="flex items-center px-4 py-2 border-t border-border">
          <button
            type="button"
            onClick={() => {
              setAutoScroll(true);
              bottomRef.current?.scrollIntoView({ behavior: "smooth" });
            }}
            className="text-xs font-terminal px-2 py-1 rounded border border-border hover:bg-muted/50 transition-colors"
            style={{ color: "oklch(var(--muted-foreground))" }}
          >
            ↓ seguir
          </button>
        </div>
      )}
    </section>
  );
}

// ── Saldo Panel ────────────────────────────────────────────────────────────
function WithdrawForm({
  token,
  decimals,
  onWithdraw,
}: {
  token: "ICP" | "ckUSDT";
  decimals: number;
  onWithdraw: (amount: bigint, to: Principal) => Promise<void>;
}) {
  const [amount, setAmount] = useState("");
  const [destination, setDestination] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmStep, setConfirmStep] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) {
      toast.error("Valor inválido");
      return;
    }
    if (!destination.trim()) {
      toast.error("Endereço de destino obrigatório");
      return;
    }

    if (!confirmStep) {
      setConfirmStep(true);
      return;
    }

    setIsSubmitting(true);
    try {
      const rawAmount = BigInt(Math.round(parsed * decimals));
      const toPrincipal = Principal.fromText(destination.trim());
      await onWithdraw(rawAmount, toPrincipal);
      toast.success(`${token} sacado com sucesso`);
      setAmount("");
      setDestination("");
      setConfirmStep(false);
    } catch (err) {
      toast.error(`Falha ao sacar ${token}`);
      console.error(err);
      setConfirmStep(false);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <Label
          className="text-xs font-mono tracking-wide"
          style={{ color: "oklch(var(--muted-foreground))" }}
        >
          Valor ({token})
        </Label>
        <Input
          type="number"
          step="any"
          min="0"
          value={amount}
          onChange={(e) => { setAmount(e.target.value); setConfirmStep(false); }}
          placeholder={token === "ICP" ? "0.0000" : "0.00"}
          className="font-terminal h-9 text-sm"
          style={{ background: "oklch(var(--input))" }}
        />
      </div>
      <div className="space-y-1.5">
        <Label
          className="text-xs font-mono tracking-wide"
          style={{ color: "oklch(var(--muted-foreground))" }}
        >
          Destino (Principal)
        </Label>
        <Input
          type="text"
          value={destination}
          onChange={(e) => { setDestination(e.target.value); setConfirmStep(false); }}
          placeholder="aaaaa-bbbbb-..."
          className="font-terminal h-9 text-xs"
          style={{ background: "oklch(var(--input))" }}
        />
      </div>

      {confirmStep && (
        <div
          className="px-3 py-2 rounded text-xs font-terminal"
          style={{
            background: "oklch(0.65 0.2 45 / 0.1)",
            border: "1px solid oklch(0.65 0.2 45 / 0.25)",
            color: "oklch(0.75 0.12 45)",
          }}
        >
          Confirma o saque de <strong>{amount} {token}</strong> para{" "}
          <span className="break-all">{destination.slice(0, 20)}…</span>?
        </div>
      )}

      <div className="flex gap-2">
        {confirmStep && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setConfirmStep(false)}
            className="h-9 text-xs flex-1"
          >
            Cancelar
          </Button>
        )}
        <Button
          type="submit"
          size="sm"
          disabled={isSubmitting}
          className="h-9 text-xs font-semibold gap-1.5 flex-1 transition-all"
          style={
            !isSubmitting
              ? {
                  background: confirmStep
                    ? "oklch(0.65 0.2 25)"
                    : "oklch(var(--primary))",
                  color: "oklch(var(--primary-foreground))",
                }
              : {}
          }
        >
          {isSubmitting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ArrowUpRight className="h-3.5 w-3.5" />
          )}
          {isSubmitting ? "Enviando…" : confirmStep ? "Confirmar saque" : `Sacar ${token}`}
        </Button>
      </div>
    </form>
  );
}

function SaldoPanel({
  canisterPrincipal,
  isPrincipalLoading,
  balances,
  isBalancesLoading,
  onRefreshBalances,
  onRefreshPrincipal,
  onWithdrawICP,
  onWithdrawCKUSDT,
}: {
  canisterPrincipal: string;
  isPrincipalLoading: boolean;
  balances: Balances | null;
  isBalancesLoading: boolean;
  onRefreshBalances: () => void;
  onRefreshPrincipal: () => void;
  onWithdrawICP: (amount: bigint, to: Principal) => Promise<void>;
  onWithdrawCKUSDT: (amount: bigint, to: Principal) => Promise<void>;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!canisterPrincipal) return;
    try {
      await navigator.clipboard.writeText(canisterPrincipal);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Falha ao copiar");
    }
  }

  const icpFormatted =
    balances !== null
      ? (Number(balances.icpBalance) / 1e8).toFixed(4)
      : "0.0000";
  const ckusdtFormatted =
    balances !== null
      ? (Number(balances.ckusdtBalance) / 1e6).toFixed(2)
      : "0.00";

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-5">
      {/* ── Endereço para Depósito ── */}
      <section>
        {/* Section header */}
        <div className="flex items-center gap-2 mb-2">
          <div
            className="flex items-center justify-center h-6 w-6 rounded"
            style={{
              background: "oklch(var(--primary) / 0.1)",
              border: "1px solid oklch(var(--primary) / 0.2)",
            }}
          >
            <Activity className="h-3.5 w-3.5" style={{ color: "oklch(var(--primary))" }} />
          </div>
          <h3 className="text-sm font-semibold tracking-wide text-foreground">
            Endereço para Depósito
          </h3>
          <button
            type="button"
            onClick={onRefreshPrincipal}
            disabled={isPrincipalLoading}
            title="Atualizar endereço"
            className="ml-auto flex items-center gap-1 px-2 py-1 rounded text-xs font-terminal transition-colors hover:bg-white/10 disabled:opacity-50"
            style={{ color: "oklch(var(--muted-foreground))" }}
          >
            {isPrincipalLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
            Atualizar Endereço
          </button>
        </div>

        {/* Deposit instruction */}
        <p
          className="mb-3 font-terminal text-xs leading-relaxed"
          style={{ color: "oklch(var(--muted-foreground))" }}
        >
          Envie ICP ou ckUSDT diretamente para este endereço para financiar o bot
        </p>

        {/* Address box — always rendered, skeleton only the text while loading */}
        <div
          className="flex items-start gap-2 px-3 py-3 rounded"
          style={{
            background: "oklch(var(--terminal-bg))",
            border: `1px solid ${canisterPrincipal ? "oklch(var(--primary) / 0.35)" : "oklch(var(--border))"}`,
            boxShadow: canisterPrincipal ? "0 0 0 3px oklch(var(--primary) / 0.06)" : "none",
          }}
        >
          {isPrincipalLoading ? (
            <Skeleton className="h-5 flex-1 rounded" />
          ) : canisterPrincipal ? (
            <>
              <span
                className="font-terminal text-xs flex-1 break-all leading-relaxed select-all"
                style={{ color: "oklch(var(--primary))" }}
              >
                {canisterPrincipal}
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="shrink-0 p-1.5 rounded transition-colors hover:bg-white/10 mt-0.5"
                title="Copiar endereço"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5" style={{ color: "oklch(0.72 0.16 145)" }} />
                ) : (
                  <Copy className="h-3.5 w-3.5" style={{ color: "oklch(var(--muted-foreground))" }} />
                )}
              </button>
            </>
          ) : (
            <span
              className="font-terminal text-xs flex-1 italic"
              style={{ color: "oklch(var(--muted-foreground) / 0.6)" }}
            >
              Endereço ainda não disponível — aguarde alguns segundos e clique em "Atualizar Endereço"
            </span>
          )}
        </div>

        {canisterPrincipal && (
          <p
            className="mt-2 font-terminal text-xs"
            style={{ color: "oklch(0.68 0.18 145 / 0.8)" }}
          >
            ✓ Clique no endereço para selecionar e copiar, ou use o botão de cópia
          </p>
        )}

        {/* ICDex link */}
        <a
          href="https://icdex.io/trade/ICP_ckUSDT"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex items-center gap-2 px-3 py-2.5 rounded transition-opacity hover:opacity-80"
          style={{
            background: "oklch(var(--primary) / 0.07)",
            border: "1px solid oklch(var(--primary) / 0.2)",
            textDecoration: "none",
          }}
        >
          <Activity className="h-3.5 w-3.5 shrink-0" style={{ color: "oklch(var(--primary))" }} />
          <span className="font-terminal text-xs flex-1" style={{ color: "oklch(var(--primary))" }}>
            Converter ICP → ckUSDT no ICDex
          </span>
          <ArrowUpRight className="h-3.5 w-3.5 shrink-0" style={{ color: "oklch(var(--primary) / 0.6)" }} />
        </a>
      </section>

      {/* Divider */}
      <div style={{ borderTop: "1px solid oklch(var(--border))" }} />

      {/* ── Saldos Atuais ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div
              className="flex items-center justify-center h-6 w-6 rounded"
              style={{
                background: "oklch(var(--primary) / 0.1)",
                border: "1px solid oklch(var(--primary) / 0.2)",
              }}
            >
              <Wallet className="h-3.5 w-3.5" style={{ color: "oklch(var(--primary))" }} />
            </div>
            <h3 className="text-sm font-semibold tracking-wide text-foreground">
              Saldos Atuais
            </h3>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefreshBalances}
            disabled={isBalancesLoading}
            className="h-7 text-xs gap-1.5"
          >
            {isBalancesLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
            Atualizar
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* ICP balance */}
          <div
            className="rounded px-3 py-2.5"
            style={{
              background: "oklch(var(--muted) / 0.3)",
              border: "1px solid oklch(var(--border))",
            }}
          >
            <div
              className="font-terminal text-xs tracking-widest uppercase mb-1"
              style={{ color: "oklch(var(--muted-foreground))" }}
            >
              ICP
            </div>
            {isBalancesLoading || icpFormatted === null ? (
              <Skeleton className="h-6 w-20" />
            ) : (
              <div
                className="font-terminal text-lg font-semibold leading-none"
                style={{ color: "oklch(var(--foreground))" }}
              >
                {icpFormatted}
              </div>
            )}
          </div>

          {/* ckUSDT balance */}
          <div
            className="rounded px-3 py-2.5"
            style={{
              background: "oklch(var(--muted) / 0.3)",
              border: "1px solid oklch(var(--border))",
            }}
          >
            <div
              className="font-terminal text-xs tracking-widest uppercase mb-1"
              style={{ color: "oklch(var(--muted-foreground))" }}
            >
              ckUSDT
            </div>
            {isBalancesLoading || ckusdtFormatted === null ? (
              <Skeleton className="h-6 w-20" />
            ) : (
              <div
                className="font-terminal text-lg font-semibold leading-none"
                style={{ color: "oklch(var(--foreground))" }}
              >
                {ckusdtFormatted}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Divider */}
      <div style={{ borderTop: "1px solid oklch(var(--border))" }} />

      {/* ── Sacar ── */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <div
            className="flex items-center justify-center h-6 w-6 rounded"
            style={{
              background: "oklch(0.65 0.2 25 / 0.1)",
              border: "1px solid oklch(0.65 0.2 25 / 0.2)",
            }}
          >
            <ArrowUpRight className="h-3.5 w-3.5" style={{ color: "oklch(0.65 0.2 25)" }} />
          </div>
          <h3 className="text-sm font-semibold tracking-wide text-foreground">
            Sacar
          </h3>
        </div>

        <div className="grid grid-cols-1 gap-5">
          {/* ICP withdraw */}
          <div
            className="rounded p-3"
            style={{
              background: "oklch(var(--muted) / 0.15)",
              border: "1px solid oklch(var(--border))",
            }}
          >
            <div
              className="font-terminal text-xs tracking-widest uppercase mb-3"
              style={{ color: "oklch(var(--muted-foreground))" }}
            >
              ICP
            </div>
            <WithdrawForm
              token="ICP"
              decimals={1e8}
              onWithdraw={onWithdrawICP}
            />
          </div>

          {/* ckUSDT withdraw */}
          <div
            className="rounded p-3"
            style={{
              background: "oklch(var(--muted) / 0.15)",
              border: "1px solid oklch(var(--border))",
            }}
          >
            <div
              className="font-terminal text-xs tracking-widest uppercase mb-3"
              style={{ color: "oklch(var(--muted-foreground))" }}
            >
              ckUSDT
            </div>
            <WithdrawForm
              token="ckUSDT"
              decimals={1e6}
              onWithdraw={onWithdrawCKUSDT}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

// ── Config Section ─────────────────────────────────────────────────────────
function ConfigSection({
  config,
  isRunning,
  isSaving,
  onSave,
}: {
  config: BotConfig;
  isRunning: boolean;
  isSaving: boolean;
  onSave: (c: BotConfig) => void;
}) {
  const [local, setLocal] = useState<BotConfig>(config);

  useEffect(() => {
    setLocal(config);
  }, [config]);

  function handleChange(field: keyof BotConfig, value: string) {
    setLocal((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave(local);
  }

  const disabled = isRunning || isSaving;

  return (
    <section className="animate-fade-up-d2">
      <div className="flex items-center gap-2 mb-4">
        <Settings className="h-4 w-4" style={{ color: "oklch(var(--primary))" }} />
        <h2 className="text-sm font-semibold tracking-wide text-foreground">Configurações</h2>
        {isRunning && (
          <span
            className="font-terminal text-xs px-1.5 py-0.5 rounded"
            style={{
              background: "oklch(0.68 0.18 145 / 0.12)",
              color: "oklch(0.68 0.18 145)",
            }}
          >
            readonly
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label
            htmlFor="numOrders"
            className="text-xs font-mono tracking-wide"
            style={{ color: "oklch(var(--muted-foreground))" }}
          >
            Nº de Ordens
          </Label>
          <Input
            id="numOrders"
            type="number"
            min={2}
            max={100}
            value={local.numOrders}
            onChange={(e) => handleChange("numOrders", e.target.value)}
            disabled={disabled}
            className="font-terminal h-9 text-sm"
            style={{
              background: disabled ? "oklch(var(--muted) / 0.3)" : "oklch(var(--input))",
            }}
          />
        </div>

        <div className="space-y-1.5">
          <Label
            htmlFor="spread"
            className="text-xs font-mono tracking-wide"
            style={{ color: "oklch(var(--muted-foreground))" }}
          >
            Spread (%)
          </Label>
          <Input
            id="spread"
            type="number"
            step="0.01"
            min={0.01}
            max={10}
            value={local.spreadPercent}
            onChange={(e) => handleChange("spreadPercent", e.target.value)}
            disabled={disabled}
            placeholder="0.45"
            className="font-terminal h-9 text-sm"
            style={{
              background: disabled ? "oklch(var(--muted) / 0.3)" : "oklch(var(--input))",
            }}
          />
        </div>

        <div className="space-y-1.5">
          <Label
            htmlFor="interval"
            className="text-xs font-mono tracking-wide"
            style={{ color: "oklch(var(--muted-foreground))" }}
          >
            Intervalo (seg)
          </Label>
          <Input
            id="interval"
            type="number"
            min={10}
            max={3600}
            value={local.intervalSeconds}
            onChange={(e) => handleChange("intervalSeconds", e.target.value)}
            disabled={disabled}
            className="font-terminal h-9 text-sm"
            style={{
              background: disabled ? "oklch(var(--muted) / 0.3)" : "oklch(var(--input))",
            }}
          />
        </div>

        <Button
          type="submit"
          disabled={disabled}
          className="w-full h-9 text-sm font-semibold gap-2 transition-all"
          style={
            !disabled
              ? {
                  background: "oklch(var(--primary))",
                  color: "oklch(var(--primary-foreground))",
                }
              : {}
          }
        >
          {isSaving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
          {isSaving ? "Salvando..." : "Salvar configurações"}
        </Button>
      </form>
    </section>
  );
}

// ── Main App ───────────────────────────────────────────────────────────────
export default function App() {
  const { actor, isFetching: actorLoading } = useActor();

  // State
  const [status, setStatus] = useState<BotStatus>({ isRunning: false, lastMidPrice: 0n, activeOrderCount: 0n });
  const [config, setConfig] = useState<BotConfig>({
    numOrders: 20,
    spreadPercent: "0.45",
    intervalSeconds: 60,
  });
  const [logs, setLogs] = useState<string[]>([]);

  // Tab
  const [activeTab, setActiveTab] = useState<ActiveTab>("logs");

  // Saldo state
  const [canisterPrincipal, setCanisterPrincipal] = useState("");
  const [isPrincipalLoading, setIsPrincipalLoading] = useState(false);
  const [balances, setBalances] = useState<Balances | null>(null);
  const [isBalancesLoading, setIsBalancesLoading] = useState(false);

  // Loading states
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // ── Fetch helpers ─────────────────────────────────────────────────────
  const fetchStatus = useCallback(async () => {
    if (!actor) return;
    try {
      const s = await actor.getStatus();
      setStatus({
        isRunning: s.isRunning,
        lastMidPrice: s.lastMidPrice,
        activeOrderCount: s.activeOrderCount,
      });
    } catch {
      // silent — polling will retry
    }
  }, [actor]);

  const fetchLogs = useCallback(async () => {
    if (!actor) return;
    try {
      const l = await actor.getLogs();
      setLogs(l);
    } catch {
      // silent
    }
  }, [actor]);

  const fetchConfig = useCallback(async () => {
    if (!actor) return;
    try {
      const c = await actor.getConfig();
      setConfig({
        numOrders: Number(c.numOrders),
        spreadPercent: (Number(c.spreadBps) / 100).toFixed(2),
        intervalSeconds: Number(c.intervalSeconds),
      });
    } catch {
      // silent
    }
  }, [actor]);

  const fetchCanisterPrincipal = useCallback(async () => {
    if (!actor) return;
    setIsPrincipalLoading(true);
    try {
      // Always initialize first to ensure the backend sets the principal
      await actor.initCanisterPrincipal();
      const principal = await actor.getCanisterPrincipal();
      setCanisterPrincipal(principal || "");
    } catch {
      // Try to get it anyway even if init failed
      try {
        const principal = await actor.getCanisterPrincipal();
        setCanisterPrincipal(principal || "");
      } catch {
        // silent — user can retry with "Atualizar Endereço"
      }
    } finally {
      setIsPrincipalLoading(false);
    }
  }, [actor]);

  const fetchBalances = useCallback(async () => {
    if (!actor) return;
    setIsBalancesLoading(true);
    try {
      const b = await actor.getBalances();
      setBalances({ icpBalance: b.icpBalance, ckusdtBalance: b.ckusdtBalance });
    } catch {
      // On error, show zeroes rather than leaving null (prevents stale skeleton)
      setBalances((prev) => prev ?? { icpBalance: 0n, ckusdtBalance: 0n });
    } finally {
      setIsBalancesLoading(false);
    }
  }, [actor]);

  // ── Initial load ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!actor || actorLoading || initialized) return;

    let cancelled = false;
    const timeout = setTimeout(() => {
      if (!cancelled) setInitialized(true);
    }, 8000);

    async function init() {
      await Promise.allSettled([fetchStatus(), fetchLogs(), fetchConfig(), fetchCanisterPrincipal()]);
      if (!cancelled) {
        clearTimeout(timeout);
        setInitialized(true);
      }
    }
    void init();

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [actor, actorLoading, initialized, fetchStatus, fetchLogs, fetchConfig, fetchCanisterPrincipal]);

  // ── Fetch balances and principal every time user switches to Saldo tab ──
  const fetchBalancesRef = useRef(fetchBalances);
  fetchBalancesRef.current = fetchBalances;
  const fetchCanisterPrincipalRef = useRef(fetchCanisterPrincipal);
  fetchCanisterPrincipalRef.current = fetchCanisterPrincipal;

  useEffect(() => {
    if (activeTab === "saldo" && actor) {
      void fetchBalancesRef.current();
      // Also refresh the principal if it hasn't been loaded yet
      if (!canisterPrincipal && !isPrincipalLoading) {
        void fetchCanisterPrincipalRef.current();
      }
    }
  }, [activeTab, actor, canisterPrincipal, isPrincipalLoading]);

  // ── Polling every 5 seconds ───────────────────────────────────────────
  useEffect(() => {
    if (!actor || !initialized) return;

    const id = setInterval(() => {
      Promise.all([fetchStatus(), fetchLogs()]);
    }, 5000);

    return () => clearInterval(id);
  }, [actor, initialized, fetchStatus, fetchLogs]);

  // ── Actions ───────────────────────────────────────────────────────────
  async function handleStart() {
    if (!actor) return;
    setIsStarting(true);
    try {
      await actor.startBot();
      await fetchStatus();
      toast.success("Bot iniciado com sucesso");
    } catch (err) {
      toast.error("Falha ao iniciar o bot");
      console.error(err);
    } finally {
      setIsStarting(false);
    }
  }

  async function handleStop() {
    if (!actor) return;
    setIsStopping(true);
    try {
      await actor.stopBot();
      await fetchStatus();
      toast.success("Bot parado");
    } catch (err) {
      toast.error("Falha ao parar o bot");
      console.error(err);
    } finally {
      setIsStopping(false);
    }
  }

  async function handleSaveConfig(newConfig: BotConfig) {
    if (!actor) return;
    setIsSaving(true);
    try {
      const numOrders = BigInt(Math.round(Number(newConfig.numOrders)));
      const spreadBps = BigInt(Math.round(parseFloat(newConfig.spreadPercent) * 100));
      const intervalSeconds = BigInt(Math.round(Number(newConfig.intervalSeconds)));
      await actor.setConfig(numOrders, spreadBps, intervalSeconds);
      setConfig(newConfig);
      toast.success("Configurações salvas");
    } catch (err) {
      toast.error("Falha ao salvar configurações");
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleClearLogs() {
    if (!actor) return;
    setIsClearing(true);
    try {
      await actor.clearLogs();
      setLogs([]);
      toast.success("Logs limpos");
    } catch (err) {
      toast.error("Falha ao limpar logs");
      console.error(err);
    } finally {
      setIsClearing(false);
    }
  }

  async function handleWithdrawICP(amount: bigint, to: Principal) {
    if (!actor) return;
    await actor.withdrawICP(amount, to);
    await fetchBalances();
  }

  async function handleWithdrawCKUSDT(amount: bigint, to: Principal) {
    if (!actor) return;
    await actor.withdrawCKUSDT(amount, to);
    await fetchBalances();
  }

  // ── Render ────────────────────────────────────────────────────────────
  const isRunning = status.isRunning;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "oklch(var(--background))" }}>
      <Toaster
        theme="dark"
        toastOptions={{
          style: {
            background: "oklch(var(--card))",
            border: "1px solid oklch(var(--border))",
            color: "oklch(var(--foreground))",
          },
        }}
      />

      {/* ── Header ── */}
      <header
        className="border-b border-border animate-fade-up"
        style={{
          background: "oklch(var(--card))",
          boxShadow: "0 1px 0 oklch(var(--border))",
        }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center h-9 w-9 rounded"
              style={{
                background: "oklch(var(--primary) / 0.1)",
                border: "1px solid oklch(var(--primary) / 0.2)",
              }}
            >
              <Activity className="h-4 w-4" style={{ color: "oklch(var(--primary))" }} />
            </div>
            <div>
              <h1
                className="text-base font-semibold leading-none tracking-tight"
                style={{ color: "oklch(var(--foreground))" }}
              >
                ICDex Grid Bot
              </h1>
              <p
                className="font-terminal text-xs mt-0.5 tracking-wider"
                style={{ color: "oklch(var(--muted-foreground))" }}
              >
                ICP / ckUSDT
              </p>
            </div>
          </div>

          {/* Status badge */}
          <div
            className="flex items-center gap-3 px-3 py-1.5 rounded border"
            style={{
              background: isRunning
                ? "oklch(0.68 0.18 145 / 0.07)"
                : "oklch(var(--muted) / 0.3)",
              borderColor: isRunning
                ? "oklch(0.68 0.18 145 / 0.25)"
                : "oklch(var(--border))",
            }}
          >
            <StatusDot isRunning={isRunning} />
          </div>
        </div>
      </header>

      {/* ── Main content ── */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[340px,1fr] gap-5 h-full">
          {/* Left column — controls + config */}
          <div className="flex flex-col gap-5">
            {/* Control buttons */}
            <div
              className="rounded-lg border border-border p-4 animate-fade-up-d1"
              style={{ background: "oklch(var(--card))" }}
            >
              {!initialized ? (
                <div className="space-y-3">
                  <Skeleton className="h-5 w-24 rounded" />
                  <div className="grid grid-cols-2 gap-3">
                    <Skeleton className="h-10 rounded" />
                    <Skeleton className="h-10 rounded" />
                  </div>
                  <Skeleton className="h-14 rounded" />
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-4">
                    <Play className="h-4 w-4" style={{ color: "oklch(var(--primary))" }} />
                    <h2 className="text-sm font-semibold tracking-wide text-foreground">
                      Controles
                    </h2>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      onClick={handleStart}
                      disabled={isRunning || isStarting || actorLoading}
                      className="h-10 text-sm font-semibold gap-2 transition-all"
                      style={
                        !isRunning && !isStarting
                          ? {
                              background: "oklch(0.68 0.18 145)",
                              color: "oklch(0.12 0.005 240)",
                              boxShadow: "0 0 16px oklch(0.68 0.18 145 / 0.2)",
                            }
                          : {}
                      }
                    >
                      {isStarting ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Play className="h-3.5 w-3.5" />
                      )}
                      {isStarting ? "Iniciando…" : "Iniciar Bot"}
                    </Button>

                    <Button
                      onClick={handleStop}
                      disabled={!isRunning || isStopping || actorLoading}
                      variant="destructive"
                      className="h-10 text-sm font-semibold gap-2 transition-all"
                    >
                      {isStopping ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Square className="h-3.5 w-3.5" />
                      )}
                      {isStopping ? "Parando…" : "Parar Bot"}
                    </Button>
                  </div>

                  {/* Status summary rows */}
                  <div
                    className="mt-3 px-3 py-2 rounded font-terminal text-xs space-y-1"
                    style={{
                      background: "oklch(var(--muted) / 0.3)",
                      color: "oklch(var(--muted-foreground))",
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span>Ordens ativas: {Number(status.activeOrderCount)}</span>
                      <span>Loop: {config.intervalSeconds}s</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>
                        Mid-price:{" "}
                        {status.lastMidPrice === 0n
                          ? "—"
                          : (Number(status.lastMidPrice) / 1e8).toFixed(4)}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Config card */}
            <div
              className="rounded-lg border border-border p-4 flex-1"
              style={{ background: "oklch(var(--card))" }}
            >
              {!initialized ? (
                <div className="space-y-4">
                  <Skeleton className="h-5 w-32 rounded" />
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="space-y-1.5">
                      <Skeleton className="h-4 w-24 rounded" />
                      <Skeleton className="h-9 w-full rounded" />
                    </div>
                  ))}
                  <Skeleton className="h-9 w-full rounded" />
                </div>
              ) : (
                <ConfigSection
                  config={config}
                  isRunning={isRunning}
                  isSaving={isSaving}
                  onSave={handleSaveConfig}
                />
              )}
            </div>
          </div>

          {/* Right column — tabbed: Logs / Saldo — always visible */}
          <div
            className="rounded-lg border border-border overflow-hidden flex flex-col animate-fade-up-d3"
            style={{
              background: "oklch(var(--card))",
              height: "calc(100vh - 180px)",
              minHeight: "520px",
              maxHeight: "none",
            }}
          >
            {/* Tab switcher + panel header — always rendered */}
            <div
              className="flex items-center justify-between px-3 py-3 border-b border-border shrink-0"
              style={{ background: "oklch(var(--card))" }}
            >
              {/* Tab buttons — pill style, highly visible */}
              <div
                className="flex items-center gap-0 p-1 rounded-lg"
                style={{
                  background: "oklch(var(--terminal-bg))",
                  border: "1px solid oklch(var(--border))",
                }}
              >
                <button
                  type="button"
                  onClick={() => setActiveTab("logs")}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold transition-all rounded-md"
                  style={
                    activeTab === "logs"
                      ? {
                          color: "oklch(var(--primary-foreground))",
                          background: "oklch(var(--primary))",
                          boxShadow: "0 1px 4px oklch(0 0 0 / 0.3)",
                        }
                      : {
                          color: "oklch(var(--muted-foreground))",
                          background: "transparent",
                        }
                  }
                >
                  <Terminal className="h-3.5 w-3.5" />
                  Logs
                  {logs.length > 0 && activeTab !== "logs" && (
                    <span
                      className="font-terminal text-xs px-1.5 py-0.5 rounded-full ml-0.5"
                      style={{
                        background: "oklch(var(--primary) / 0.18)",
                        color: "oklch(var(--primary))",
                      }}
                    >
                      {logs.length}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("saldo")}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold transition-all rounded-md"
                  style={
                    activeTab === "saldo"
                      ? {
                          color: "oklch(var(--primary-foreground))",
                          background: "oklch(var(--primary))",
                          boxShadow: "0 1px 4px oklch(0 0 0 / 0.3)",
                        }
                      : {
                          color: "oklch(var(--muted-foreground))",
                          background: "transparent",
                        }
                  }
                >
                  <Wallet className="h-3.5 w-3.5" />
                  Saldo
                </button>
              </div>

              {/* Right actions per tab */}
              {activeTab === "logs" && (
                <div className="flex items-center gap-2">
                  {logs.length > 0 && (
                    <span
                      className="font-terminal text-xs px-1.5 py-0.5 rounded"
                      style={{
                        background: "oklch(var(--primary) / 0.12)",
                        color: "oklch(var(--primary))",
                      }}
                    >
                      {logs.length}
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearLogs}
                    disabled={isClearing || logs.length === 0}
                    className="h-7 text-xs gap-1.5 hover:bg-destructive/10 hover:text-destructive transition-colors"
                  >
                    {isClearing ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RotateCcw className="h-3 w-3" />
                    )}
                    Limpar
                  </Button>
                </div>
              )}
            </div>

            {/* Tab content */}
            {activeTab === "logs" ? (
              <LogPanel logs={logs} />
            ) : (
              <SaldoPanel
                canisterPrincipal={canisterPrincipal}
                isPrincipalLoading={isPrincipalLoading}
                balances={balances}
                isBalancesLoading={isBalancesLoading}
                onRefreshBalances={fetchBalances}
                onRefreshPrincipal={fetchCanisterPrincipal}
                onWithdrawICP={handleWithdrawICP}
                onWithdrawCKUSDT={handleWithdrawCKUSDT}
              />
            )}
          </div>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer
        className="border-t border-border mt-auto"
        style={{ background: "oklch(var(--card))" }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <span
            className="font-terminal text-xs"
            style={{ color: "oklch(var(--muted-foreground))" }}
          >
            © 2026 · ICP / ckUSDT · jgxow-pqaaa-aaaar-qahaq-cai
          </span>
          <a
            href="https://caffeine.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="font-terminal text-xs transition-colors hover:opacity-80"
            style={{ color: "oklch(var(--primary) / 0.7)" }}
          >
            built with ♥ caffeine.ai
          </a>
        </div>
      </footer>
    </div>
  );
}
