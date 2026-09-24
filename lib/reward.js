/**
 * Block reward of FewBit mainnet: 50 FBIT, halved every 300000 blocks (GetBlockSubsidy of the node, computed from the height of the
 * previous block). Amounts in atomic units (1 FBIT = 1e8). Smartnodes and the founder take their share of it inside the block, and the fees
 * of the transactions come on top: the pool reads the exact reward of its own blocks from its wallet.
 **/
const FBIT_BASE = 100000000;
const HALVING_INTERVAL = 300000;

exports.minerReward = function (height) {
	if (!(height > 0)) return 0;
	let halvings = Math.floor((height - 1) / HALVING_INTERVAL);
	if (halvings >= 64) return 0;
	return Math.floor(50 * FBIT_BASE / Math.pow(2, halvings));
};
