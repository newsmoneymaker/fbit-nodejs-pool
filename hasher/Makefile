# grhash needs the FewBit Core source tree that was built (headers plus the static libraries of its build) and its depends prefix:
#   FEWBIT=/path/to/Core-Wallet make        (default /root/fbit-src, HOST default x86_64-pc-linux-gnu)
# STATIC=-static makes a binary that runs on any Linux (build it where the node is built).
FEWBIT ?= /root/fbit-src
HOST ?= x86_64-pc-linux-gnu
DEPS = $(FEWBIT)/depends/$(HOST)
CXX ?= g++
STATIC ?=
SRC = $(FEWBIT)/src
LIBS = $(SRC)/libfewbit_server.a $(SRC)/libfewbit_common.a $(SRC)/libfewbit_util.a $(SRC)/libfewbit_consensus.a \
  $(SRC)/crypto/libfewbit_crypto_base.a $(SRC)/crypto/libfewbit_crypto_sse41.a $(SRC)/crypto/libfewbit_crypto_avx2.a $(SRC)/crypto/libfewbit_crypto_shani.a \
  $(SRC)/leveldb/libleveldb.a $(SRC)/leveldb/libmemenv.a $(SRC)/secp256k1/.libs/libsecp256k1.a $(SRC)/univalue/.libs/libunivalue.a
grhash: grhash.cpp
	$(CXX) -O2 -std=c++11 $(STATIC) -I$(SRC) -I$(SRC)/config -I$(DEPS)/include -o $@ $< -Wl,--start-group $(LIBS) -Wl,--end-group \
	  -L$(DEPS)/lib -lboost_system-mt-x64 -lboost_filesystem-mt-x64 -lboost_thread-mt-x64 -lboost_chrono-mt-x64 -lboost_program_options-mt-x64 -lssl -lcrypto -levent_pthreads -levent -lbls-dash -lrelic_s -lgmp -ldb_cxx -lzmq -lbacktrace -lpthread -ldl
clean:
	rm -f grhash
