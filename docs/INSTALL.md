# Installing a FewBit pool

Paths below are examples: the pool in `/opt/fbit-nodejs-pool`, the node and its data in `/opt/fbit`, all run by the user `fbitpool`
(the systemd templates in `deployment/systemd/` use these paths).

## 1. FewBit node and wallet

FewBit Core is a Raptoreum/Dash based node: `https://github.com/fewbit-network/Core-Wallet` (MIT). It ships Linux binaries in its releases (built for Ubuntu 20/22); on other systems build from source.
The source uses its own `depends` system (boost 1.70, OpenSSL 1.0.1, Berkeley DB 4.8, bls-dash ...) and builds with GCC 12 after **one one-line fix** in `src/undo.h`: the expression in
`VARINT(txout->nHeight * 2 + (txout->fCoinBase ? 1 : 0), VarIntMode::NONNEGATIVE_SIGNED)` must be cast to `(int)` (GCC 12 sees an unsigned type and the `static_assert` fails).
A host with an old glibc/GCC (Debian 10 has GCC 8) builds and runs the node in a newer userland, for example a Debian 12 chroot made with `debootstrap`.

```
git clone https://github.com/fewbit-network/Core-Wallet && cd Core-Wallet
# build dependencies: curl build-essential libtool autotools-dev automake pkg-config python3 bsdmainutils patch bison cmake xz-utils unzip
make -C depends NO_QT=1 NO_UPNP=1 NO_NATPMP=1 -j4          # about 30 minutes
./autogen.sh
./configure --prefix=$PWD/depends/x86_64-pc-linux-gnu --without-gui --disable-tests --disable-bench --with-incompatible-bdb --disable-man
make -j4                                                    # src/fewbitd, src/fewbit-cli
```

`/opt/fbit/data/fewbit.conf`:

```
server=1
listen=1
daemon=0
rpcuser=fbitpool
rpcpassword=<a long random password>
rpcbind=127.0.0.1
rpcallowip=127.0.0.1
rpcport=1157
port=1155
maxconnections=40
txindex=1
addnode=89.168.20.232
addnode=89.168.18.209
addnode=pool.fewbit.online
addnode=fewbit.online
```

**Use the project's bootstrap.** Validating the chain from the genesis block computes a GhostRider hash per header and takes hours. The releases of the repository carry the newest `Bootstrap.tar.gz`
(a data directory snapshot: `blocks/`, `chainstate/`, `evodb/`, `llmq/`, `powcache.dat`, about 740 MB). Stop the node, empty the data directory (keep `fewbit.conf`), unpack it there and start the node: it
catches up the last blocks by itself (`fewbit-cli getblockchaininfo`). The smartnode sync (`mnsync status`) finishes a few minutes later; block templates are served as soon as the blockchain is synced.

The default wallet of the node is the pool wallet:

```
fewbit-cli getnewaddress "pool"          # F... : the pool address (poolServer.poolAddress)
fewbit-cli dumpwallet /safe/place/fbit-wallet-dump.txt   # the private keys: keep it offline, chmod 600 (also: fewbit-cli backupwallet <file>)
```

The wallet is a plain (non HD) wallet with a key pool: back it up again after new addresses were handed out.

## 2. GhostRider helper

The helper is a tiny program around the node's own `HashGR`; it is linked against the static libraries of the node build (so the hash is exactly the node's).

```
cd /opt/fbit-nodejs-pool/hasher && make FEWBIT=/path/to/Core-Wallet            # the build tree from step 1
# a static binary that runs on any Linux (build it where the node is built): make FEWBIT=... STATIC=-static
```

Check it against the chain: `node test/test-real-blocks.js`. A hash takes about 15 ms; `hasher.threads` helper processes work in parallel (each share is one hash).

## 3. Redis

Use a dedicated instance with a password and AOF (`deployment/redis-pool.conf.example`, unit `fbit-pool-redis`, port 6386).

## 4. The pool

```
cd /opt/fbit-nodejs-pool && npm install --production
cp config_examples/fbit.json config.json      # then edit it
```

Edit `config.json`: `poolHost`, `poolServer.poolAddress` (the wallet address of step 1), the ports and the certificate for TLS (`poolServer.sslCert/sslKey`), `redis`, `api.password`,
`node.password` or `node.passwordFile`, `blockUnlocker.poolFee` and `donations`, `payments`. **Keep `payments.dryRun: true` until the rehearsal below.**

```
cp deployment/systemd/*.service /etc/systemd/system/ && systemctl daemon-reload
systemctl enable --now fbit-pool-redis fbit-node
systemctl enable --now fbit-pool fbit-pool-api fbit-pool-unlocker fbit-pool-payments fbit-pool-charts
node test/test-fbit-proposal.js config.json        # the node itself validates a block built by the pool (needs the synchronised node)
```

The pool runs as separate modules (`init.js -module=pool|api|unlocker|payments|chartsDataCollector`), each in its own unit. Until payouts are proven, restrict the stratum ports with `poolServer.allowIPs`.
Point a miner at it: `poolpayminer -a gr -o your.pool:3800 -u <an F... address> -p x`.

## 5. Website

Copy `website_example/` to the web root, set `poolHost`, the contact and links in `config.js`, and proxy `/api` to the pool API on 127.0.0.1:8124 (`deployment/apache-vhost.conf.example` exposes only the
read-only methods).

## 6. Rehearse the payments

1. `payments.dryRun: true`: the log of `fbit-pool-payments` shows what would be paid.
2. Fund the pool wallet with a few coins (or wait for the first block), credit a small balance in Redis to your own test addresses (`<coin>:workers:<address>`, field `balance`), set `payments.onlyAccounts`
   to them, `dryRun: false`, and watch the payout confirm.
3. Remove the test accounts from Redis and set `onlyAccounts` to `[]`.

Good to know: block rewards can be spent after 100 blocks (about 3.5 hours); `deployment/pause-payments.sh` stops new payouts at once; the wallet must stay unlocked and online for the payouts (leave the
pool wallet unencrypted with only small balances in it). Of a block the pool only gets what is left after the smartnode and founder payments the template demands (about 30% of the subsidy at the time of writing).
