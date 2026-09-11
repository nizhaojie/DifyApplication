#!/usr/bin/env bash
# mirrored 模式下更新 docker 代理并等待容器全部就绪
set -u
printf '[Service]\nEnvironment="HTTP_PROXY=http://127.0.0.1:7897"\nEnvironment="HTTPS_PROXY=http://127.0.0.1:7897"\nEnvironment="NO_PROXY=localhost,127.0.0.1,192.168.0.0/16,172.16.0.0/12"\n' > /etc/systemd/system/docker.service.d/proxy.conf
systemctl daemon-reload
systemctl restart docker
sleep 3
for i in 1 2 3 4 5 6 7 8 9 10 11 12; do
  A=$(systemctl is-active docker)
  C=$(docker ps -q 2>/dev/null | wc -l)
  H=$(docker inspect -f '{{.State.Health.Status}}' docker-api-1 2>/dev/null || echo na)
  echo "try$i docker=$A containers=$C api_health=$H"
  if [ "$A" = "active" ] && [ "$C" -ge 14 ] && [ "$H" = "healthy" ]; then
    echo ALL_READY; exit 0
  fi
  sleep 10
done
echo NOT_READY_YET
