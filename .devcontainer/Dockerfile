FROM mcr.microsoft.com/devcontainers/base:ubuntu-24.04

USER vscode

# Install Volta
ARG HOME="/home/vscode"
ENV VOLTA_HOME="${HOME}/.volta"
ENV PATH="${VOLTA_HOME}/bin:${PATH}"
RUN bash -c "$(curl -fsSL https://get.volta.sh)" -- --skip-setup

CMD ["sleep", "infinity"]
