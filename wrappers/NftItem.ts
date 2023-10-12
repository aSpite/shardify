import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from 'ton-core';

export type NftItemConfig = {
    index: number,
    collectionAddress: Address
};

type NftData = {
    init: boolean,
    index: number,
    collectionAddress: Address,
    owner: Address | null,
    content: Cell | null
}

export function nftItemConfigToCell(config: NftItemConfig): Cell {
    return beginCell().storeUint(config.index, 64).storeAddress(config.collectionAddress).endCell();
}

export class NftItem implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new NftItem(address);
    }

    static createFromConfig(config: NftItemConfig, code: Cell, workchain = 0) {
        const data = nftItemConfigToCell(config);
        const init = { code, data };
        return new NftItem(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint, owner: Address, content: Cell) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().storeAddress(owner).storeRef(content).endCell(),
        });
    }

    async getNftData(provider: ContractProvider) {
        const result = await provider.get('get_nft_data', []);
        const data: NftData = {
            init: result.stack.readBoolean(),
            index: result.stack.readNumber(),
            collectionAddress: result.stack.readAddress(),
            owner: result.stack.readAddressOpt(),
            content: result.stack.readCellOpt()
        };
        return data;
    }
}
