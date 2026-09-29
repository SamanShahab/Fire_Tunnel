FROM kalilinux/kali-rolling
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
      nmap iputils-ping iproute2 curl netcat-openbsd tcpdump tshark iperf3 hping3 python3 procps \
 && rm -rf /var/lib/apt/lists/*
COPY www /srv/www
COPY entrypoint.sh /opt/lab/entrypoint.sh
RUN chmod +x /opt/lab/entrypoint.sh
ENTRYPOINT ["/opt/lab/entrypoint.sh"]
