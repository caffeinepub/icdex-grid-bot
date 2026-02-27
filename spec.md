# ICDex Grid Bot

## Current State
The app has a Motoko backend with trading loop, ICP/ckUSDT balance queries, and withdrawal functions. The frontend has a Saldo tab with deposit address, balance display, and withdrawal forms. However, the backend has bugs:
- `icrc1_balance_of` is typed to return `{ amount: Nat }` but the real ICRC-1 standard returns `Nat` directly
- `canisterPrincipalText` starts empty and requires manual `initCanisterPrincipal()` call; the canister principal should be set automatically via `Principal.fromActor(self)` on init
- `getCanisterPrincipal` is `shared` (update call) when it should be `query` to be fast

The frontend Saldo tab exists and is wired, but due to the above bugs the balance calls fail silently and the canister principal never loads, making the section appear broken.

## Requested Changes (Diff)

### Add
- Auto-initialization of canister principal in the actor's stable variable using `system` init
- `getCanisterPrincipal` exposed as `query` (read-only, fast)

### Modify
- Fix `icrc1_balance_of` return type from `{ amount: Nat }` to `Nat` (correct ICRC-1 standard)
- Fix `getICPBalance` and `getCKUSDTBalance` to use `Principal.fromActor(self)` instead of the stored text, avoiding parse failures
- Fix `withdrawICP` and `withdrawCKUSDT` to use correct `icrc1_transfer` return type (ICRC-1 returns `{ #Ok : Nat; #Err : ... }`)
- Ensure `getCanisterPrincipal` is a `query` function so the frontend gets it immediately
- Frontend: make Saldo tab always clearly visible with a prominent label, and ensure it renders on first switch

### Remove
- `initCanisterPrincipal` public function (replaced by automatic init)
- `canisterPrincipalText` stored as mutable text (use `Principal.fromActor(self)` directly)

## Implementation Plan
1. Rewrite backend `main.mo`:
   - Remove `canisterPrincipalText` mutable var and `initCanisterPrincipal` function
   - Fix `icrc1_balance_of` return type to `Nat`
   - In `getICPBalance`/`getCKUSDTBalance`, use `Principal.fromActor(self)` directly
   - Change `getCanisterPrincipal` to a `query` that returns `Principal.fromActor(self).toText()`
   - Keep all other functions intact
2. Update `backend.d.ts` to match new signatures
3. Fix frontend `App.tsx`:
   - Remove `initCanisterPrincipal` call from `fetchCanisterPrincipal`
   - Remove `isPrincipalLoading` gating that might hide the address box
   - Ensure Saldo tab renders deposit address even if balances are still loading
