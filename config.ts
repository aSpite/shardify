// const int op::mint = 21;
// const int op::provide_wallet_address = 0x2c76b973;
// const int op::take_wallet_address = 0xd1735400;
// const int op::fractionalization_fee = 6;

export const OPCODES = {
    NFT_TRANSFER: 0x5fcc3d14,
    NFT_OWNERSHIP_ASSIGNED: 0x05138d91,

    EXCESSES: 0xd53276db,

    HOLDER_RETURN: 0x1a3fdbcf,
    HOLDER_RETURN_FAIL: 0xbd017ec7,
    HOLDER_REPEAT_RETURN: 0x6855e245,

    JETTON_DEFRAC_NFT: 0x3a0f1e4c,
    JETTON_INTERNAL_TRANSFER: 0x178d4519,
    JETTON_TRANSFER_NOTIFICATION: 0x7362d09c,
    JETTON_BURN: 0x595f07bc,
    JETTON_BURN_NOTIFICATION: 0x7bdd97de,
}

export const ERRORS = {
    UNAUTHORIZED: 100,
    WRONG_NFT: 101,
    NOT_OWN: 102,
    NOT_NFT_TRANSFER: 103
}