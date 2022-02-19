ARG DENO_VERSION=1.18.2
ARG DENO_AMD64=https://github.com/denoland/deno/releases/download/v${DENO_VERSION}/deno-x86_64-unknown-linux-gnu.zip
# Unofficial ARM build, official builds are not provided at the moment, see:
# https://github.com/denoland/deno/issues/1846#issuecomment-888965232
ARG DENO_ARM64=https://github.com/LukeChannings/deno-arm64/releases/download/v${DENO_VERSION}/deno-linux-arm64.zip


FROM curlimages/curl AS deno
ARG DENO_AMD64
ARG DENO_ARM64
RUN DENO_URL="$([ "$(uname -m)" = x86_64 ] && echo "$DENO_AMD64" || echo "$DENO_ARM64" )" \
    && curl -fsSLo /tmp/deno.zip "${DENO_URL:?}"
RUN unzip -d /tmp /tmp/deno.zip deno && chmod u=rwx,go=rx /tmp/deno


# We need node to run standard-version in the release process, so using the
# node devcontainer image as a base gives us node plus a decent dev environment.
FROM mcr.microsoft.com/vscode/devcontainers/javascript-node:0-16-bullseye
COPY --from=deno --chown=root:root /tmp/deno /opt/deno/bin/deno
ENV PATH=/opt/deno/bin:${PATH}
CMD deno
