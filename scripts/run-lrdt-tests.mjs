import { spawn } from 'node:child_process';
const child=spawn(process.execPath,['--import','tsx','--test','tests/network.test.ts'],{stdio:'inherit',env:{...process.env,LANCHAT_TEST_PRIORITY:'auto'}});child.on('exit',code=>process.exitCode=code??1);
