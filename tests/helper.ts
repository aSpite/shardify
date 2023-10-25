import {Address, beginCell, Cell} from "ton-core";
import {sign} from "ton-crypto";

export function getJettonWallet(ownerAddress: Address, jettonMasterAddress: Address, jettonWalletCode: Cell,
                                partsCount: bigint, holderCode: Cell) {
    const data = beginCell()
        .storeCoins(0)
        .storeAddress(ownerAddress)
        .storeAddress(jettonMasterAddress)
        .storeRef(jettonWalletCode)
        .storeCoins(partsCount)
        .storeRef(holderCode)
        .endCell();

    const stateInit = beginCell()
        .storeUint(0, 2)
        .storeBit(true)
        .storeRef(jettonWalletCode)
        .storeBit(true)
        .storeRef(data)
        .storeBit(false)
        .endCell();

    return new Address(0, stateInit.hash());
}

export function bufferToBigInt(x: Buffer) {
    return BigInt('0x' + x.toString('hex'))
}

export function getFracBody(validUntil: number, nftItemIndex: number, nftItemCode: Cell,
                            fracPrice:bigint, creatorFeeNumerator: number) {
    return beginCell()
        .storeUint(validUntil, 32)
        .storeUint(nftItemIndex, 64)
        .storeRef(nftItemCode)
        .storeCoins(fracPrice)
        .storeUint(creatorFeeNumerator, 8)
        .endCell();
}

export function signFracBody(body: Cell, privateKey: Buffer) {
    return sign(body.hash(), privateKey)
}
