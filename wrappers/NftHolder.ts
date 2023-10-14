import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from 'ton-core';

export type NftHolderConfig = {
    jettonMasterAddress: Address,
    index: number
};

export function nftHolderConfigToCell(config: NftHolderConfig): Cell {
    return beginCell()
        .storeAddress(config.jettonMasterAddress)
        .storeUint(config.index, 64)
        .endCell();
}

export class NftHolder implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new NftHolder(address);
    }

    static createFromConfig(config: NftHolderConfig, code: Cell, workchain = 0) {
        const data = nftHolderConfigToCell(config);
        const init = { code, data };
        return new NftHolder(contractAddress(workchain, init), init);
    }

    async sendDeploy(
        provider: ContractProvider,
        via: Sender,
        value: bigint,
        partsCount: bigint,
        nftAddress: Address,
        jettonWalletCode: Cell
    ) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
                body: beginCell()
                    .storeCoins(partsCount)
                    .storeAddress(nftAddress)
                    .storeRef(jettonWalletCode)
                .endCell(),
        });
    }
}
