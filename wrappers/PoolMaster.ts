import {Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode} from 'ton-core';
import {OPCODES} from "../config";

export type PoolMasterConfig = {
    adminAddress: Address,
    publicKey: Buffer
};

export function poolMasterConfigToCell(config: PoolMasterConfig): Cell {
    return beginCell()
        .storeAddress(config.adminAddress)
        .storeBuffer(config.publicKey)
        .endCell();
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

    async sendCreatePool(
        provider: ContractProvider,
        via: Sender,
        value: bigint,
        queryID: bigint,
        signature: Buffer,
        payload: Cell,
        jettonMinterCode: Cell
    ) {
        await provider.internal(via, {
           value,
           sendMode: SendMode.PAY_GAS_SEPARATELY,
           body: beginCell()
               .storeUint(OPCODES.POOL_MASTER_CREATE_POOL, 32)
               .storeUint(queryID, 64)
               .storeBuffer(signature)
               .storeRef(payload)
               .storeRef(jettonMinterCode)
               .endCell()
        });
    }
}
