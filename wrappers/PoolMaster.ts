import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from 'ton-core';

export type PoolMasterConfig = {};

export function poolMasterConfigToCell(config: PoolMasterConfig): Cell {
    return beginCell().endCell();
}

export class PoolMaster implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new PoolMaster(address);
    }

    static createFromConfig(config: PoolMasterConfig, code: Cell, workchain = 0) {
        const data = poolMasterConfigToCell(config);
        const init = { code, data };
        return new PoolMaster(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }
}
