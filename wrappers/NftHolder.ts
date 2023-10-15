import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from 'ton-core';

export type NftHolderConfig = {
    jettonMasterAddress: Address,
    nftAddress: Address
};

type NftHolderData = {
    jettonMasterAddress: Address,
    nftAddress: Address,
    partsCount: bigint,
    ownNft: boolean
};

export function nftHolderConfigToCell(config: NftHolderConfig): Cell {
    return beginCell()
        .storeAddress(config.jettonMasterAddress)
        .storeAddress(config.nftAddress)
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
                    .storeRef(jettonWalletCode)
                .endCell(),
        });
    }

    async getHolderData(provider: ContractProvider) : Promise<NftHolderData> {
        const result = await provider.get('get_holder_data', []);
        return {
            jettonMasterAddress: result.stack.readAddress(),
            nftAddress: result.stack.readAddress(),
            partsCount: result.stack.readBigNumber(),
            ownNft: result.stack.readBoolean(),
        }
    }
}
