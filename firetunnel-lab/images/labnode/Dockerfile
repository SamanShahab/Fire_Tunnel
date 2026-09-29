FROM ubuntu:24.04
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
      iproute2 iputils-ping curl netcat-openbsd nmap tcpdump iperf3 nginx \
      openssh-server openvpn python3 procps ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && ssh-keygen -A && mkdir -p /run/sshd \
 && useradd -m -s /bin/bash labuser && echo 'labuser:LabUser@2026' | chpasswd
COPY www /opt/lab/www
COPY entrypoint.sh /opt/lab/entrypoint.sh
RUN chmod +x /opt/lab/entrypoint.sh
ENTRYPOINT ["/opt/lab/entrypoint.sh"]
