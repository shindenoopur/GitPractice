<img src="https://res.cloudinary.com/dnow2j8vo/image/upload/c_fit,w_180/logo-icon"  width=200/>

---

### Run the following command in a new bash shell.

### Step 1: Build Docker Image

####This will take some time to build. Be patient.

```bash
docker build -f Dockerfile -t chaitanya/trufflesandbox:8.12.1 .
```

### Step 2: Set up the directory structure and check networks in .env file

###### The following environment variables should be defined

###### DOCKER_WORKING_DIR=/home/node/app

###### NETWORK=ethereum

###### IMAGE_USER=<USER_TAG> e.g chaitanya

```bash
cat .env
```

### Step 3: Start Truffle docker development environment

```bash
docker network create -d bridge <networkName> // Use this network name in below command
docker container run -it -v `pwd`:/home/node/app -v /etc/localtime:/etc/localtime:ro --rm --name truffleSandBox --net <networkName> chaitanya/trufflesandbox:8.12.1 bash
```

### Step 4: Removes and Reinstalls npm packages

```bash
npm run clean
```

### Step 5: To recompile all Solidity Smart Contracts & Lint the Smart Contracts

```bash
npm run recompile
```

### Step 6: Migrate the Smart Contracts to Ganache CLI for local testing

```bash
npm run migrate
```

### Step 7: Test the Smart Contracts using Ganache for local testing

```bash
npm run test
```

### Step 8: Code coverage and Test using Ganache

```bash
npm run coverage
```

### Step 9: Code debugging using Remix

```bash
truffle-flattener ./contracts/<solidity-files> > solidityReports/remixFile.sol
```

### Step 10: Solidity Contract Summary

```bash
surya describe solidityReports/remixFile.sol > solidityReports/remixFile.dot
```

### Step 11: Solidity Markdown report

```bash
surya mdreport solidityReports/report_outfile.md solidityReports/remixFile.sol
```

#### Additional Information

##### Please follow TDD style of development.

##### a) Discuss the functionality to be implemented an the accompanying test plan

##### b) Write individual test

##### c) Run test to show test fails

##### d) Write Code to make test pass

##### e) Run test to show test passes

##### f) Repeat b to d till to complete given task
