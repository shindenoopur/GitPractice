## How to build
# docker build -f Dockerfile -t chaitanya/trufflesandbox:8.12.1 .
## How to run
# docker container run -it -v `pwd`:/home/node/app --rm --name truffleSandBox --net ethereum chaitanya/trufflesandbox:8.12.1 sh
# docker container run -i -v `pwd`/temp:/graphviz --rm markfletcher/graphviz:latest sh -c "dot -Tpng -O *.dot &&  chmod a+rw *.png"


ARG NODE_VERSION=8.12.0
FROM node:${NODE_VERSION}

RUN npm install -g truffle
RUN npm install -g ganache-cli
RUN npm install -g solhint
RUN npm install -g truffle-flattener
RUN npm install -g surya

# fixed bug in truffle debug
# ADD temp/cli.bundled.js /usr/local/lib/node_modules/truffle/build/cli.bundled.js

ENV HOME=/home/node/app
USER node

RUN mkdir -p ${HOME}
WORKDIR ${HOME}

ADD package.json ${HOME}

RUN cd ${HOME} && npm install

CMD [ "npm" , "install" ]

EXPOSE 8545



