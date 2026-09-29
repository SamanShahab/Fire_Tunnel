FROM ubuntu:24.04
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
      nftables openvpn easy-rsa openssl iproute2 iputils-ping tcpdump \
      conntrack curl python3 procps ca-certificates \
 && rm -rf /var/lib/apt/lists/*
COPY entrypoint.sh /opt/lab/entrypoint.sh
RUN chmod +x /opt/lab/entrypoint.sh
ENTRYPOINT ["/opt/lab/entrypoint.sh"]
