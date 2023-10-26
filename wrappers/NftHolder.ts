import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from 'ton-core';
import {OPCODES} from "../config";

export type NftHolderConfig = {
    jettonMasterAddress: Address,
    nftAddress: Address
};

type NftHolderData = {
    jettonMasterAddress: Address,
    nftAddress: Address,
    lastTakerAddress: Address | null,
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
        jettonWalletCode: Cell,
        nftHolderCode: Cell,
        prevOwner: Address
    ) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
                body: beginCell()
                    .storeCoins(partsCount)
                    .storeRef(jettonWalletCode)
                    .storeRef(nftHolderCode)
                    .storeAddress(prevOwner)
                .endCell(),
        });
    }

    async sendReturnNFT(
        provider: ContractProvider,
        via: Sender,
        value: bigint,
        queryID: number,
        jettonAmount: bigint,
        nftAddress: Address,
        walletOwner: Address,
    ) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(OPCODES.HOLDER_RETURN, 32)
                .storeUint(queryID, 64)
                .storeCoins(jettonAmount)
                .storeAddress(nftAddress)
                .storeAddress(walletOwner)
                .endCell(),
        });
    }

    async getHolderData(provider: ContractProvider) : Promise<NftHolderData> {
        const result = await provider.get('get_holder_data', []);
        return {
            jettonMasterAddress: result.stack.readAddress(),
            nftAddress: result.stack.readAddress(),
            lastTakerAddress: result.stack.readAddressOpt(),
            partsCount: result.stack.readBigNumber(),
            ownNft: result.stack.readBoolean(),
        }
    }

    async getJettonWalletCode(provider: ContractProvider): Promise<Cell> {
        const result = await provider.get('get_jetton_wallet_code', []);
        return result.stack.readCell();
    }
}
