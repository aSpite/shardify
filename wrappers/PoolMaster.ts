import {Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode} from 'ton-core';
import {OPCODES} from "../config";

export type PoolMasterConfig = {
    adminAddress: Address,
    publicKey: Buffer
};
export type PoolAdminData = {
    adminAddress: Address,
    publicKey: bigint
}

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

    async sendChangeAdminAddr(
        provider: ContractProvider,
        via: Sender,
        value: bigint,
        queryID: bigint,
        newAdmin: Address
    ) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(OPCODES.POOL_MASTER_ADDR_CHANGE_ADMIN, 32)
                .storeUint(queryID, 64)
                .storeAddress(newAdmin)
                .endCell()
        });
    }

    async sendChangeAdminSign(
        provider: ContractProvider,
        via: Sender,
        value: bigint,
        queryID: bigint,
        signature: Buffer,
        newAdminCell: Cell
    ) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(OPCODES.POOL_MASTER_SIGN_CHANGE_ADMIN, 32)
                .storeUint(queryID, 64)
                .storeBuffer(signature)
                .storeRef(newAdminCell)
                .endCell()
        });
    }

    async sendChangeMinterPubKey(
        provider: ContractProvider,
        via: Sender,
        value: bigint,
        queryID: bigint,
        minterAddress: Address,
        newPubKey: Buffer
    ) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(OPCODES.POOL_MASTER_CHANGE_MINTER_PUBKEY, 32)
                .storeUint(queryID, 64)
                .storeAddress(minterAddress)
                .storeBuffer(newPubKey)
                .endCell()
        });
    }

    async sendMinterWithdrawNft(
        provider: ContractProvider,
        via: Sender,
        value: bigint,
        queryID: bigint,
        minterAddress: Address,
        nftAddress: Address,
        destAddress: Address,
    ) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(OPCODES.POOL_MASTER_WITHDRAW_NFT_MINTER, 32)
                .storeUint(queryID, 64)
                .storeAddress(minterAddress)
                .storeAddress(nftAddress)
                .storeAddress(destAddress)
                .endCell()
        });
    }

    async sendChangeMinterContent(
        provider: ContractProvider,
        via: Sender,
        value: bigint,
        queryID: bigint,
        minterAddress: Address,
        newContent: Cell
    ) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(OPCODES.POOL_MASTER_CHANGE_MINTER_CONTENT, 32)
                .storeUint(queryID, 64)
                .storeAddress(minterAddress)
                .storeRef(newContent)
                .endCell()
        });
    }

    async sendChangeMinterAdmin(
        provider: ContractProvider,
        via: Sender,
        value: bigint,
        queryID: bigint,
        minterAddress: Address,
        newAdmin: Address
    ) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(OPCODES.POOL_MASTER_CHANGE_MINTER_ADMIN, 32)
                .storeUint(queryID, 64)
                .storeAddress(minterAddress)
                .storeAddress(newAdmin)
                .endCell()
        });
    }

    async sendWithdrawTon(
        provider: ContractProvider,
        via: Sender,
        value: bigint,
        queryID: bigint,
    ) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(OPCODES.POOL_MASTER_WITHDRAW_TON, 32)
                .storeUint(queryID, 64)
                .endCell()
        });
    }

    async sendWithdrawTonMinter(
        provider: ContractProvider,
        via: Sender,
        value: bigint,
        queryID: bigint,
        minterAddress: Address
    ) {
        await provider.internal(via, {
           value,
           sendMode: SendMode.PAY_GAS_SEPARATELY,
           body: beginCell()
               .storeUint(OPCODES.POOL_MASTER_WITHDRAW_TON_MINTER, 32)
               .storeUint(queryID, 64)
               .storeAddress(minterAddress)
               .endCell()
        });
    }

    async getAdminData(provider: ContractProvider): Promise<PoolAdminData> {
        const result = await provider.get('get_admin_data', []);
        return {
            adminAddress: result.stack.readAddress(),
            publicKey: result.stack.readBigNumber()
        }
    }
}
