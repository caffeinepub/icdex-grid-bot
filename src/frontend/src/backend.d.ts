import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface Balances {
    icpBalance: bigint;
    ckusdtBalance: bigint;
}
export interface backendInterface {
    clearLogs(): Promise<void>;
    getActiveOrders(): Promise<Array<bigint>>;
    getBalances(): Promise<Balances>;
    getCanisterPrincipal(): Promise<string>;
    getConfig(): Promise<{
        intervalSeconds: bigint;
        spreadBps: bigint;
        numOrders: bigint;
    }>;
    getLogs(): Promise<Array<string>>;
    getStatus(): Promise<{
        lastMidPrice: bigint;
        activeOrderCount: bigint;
        isRunning: boolean;
    }>;
    initCanisterPrincipal(): Promise<void>;
    setConfig(newNumOrders: bigint, newSpreadBps: bigint, newIntervalSeconds: bigint): Promise<void>;
    startBot(): Promise<void>;
    stopBot(): Promise<void>;
    withdrawCKUSDT(amount: bigint, to: Principal): Promise<void>;
    withdrawICP(amount: bigint, to: Principal): Promise<void>;
}
