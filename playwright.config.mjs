import {defineConfig,devices} from 'playwright/test';
export default defineConfig({
  testDir:'./tests/browser',
  fullyParallel:true,
  forbidOnly:!!process.env.CI,
  retries:process.env.CI?1:0,
  workers:2,
  timeout:30000,
  expect:{timeout:10000},
  reporter:[['list'],['html',{open:'never'}]],
  use:{baseURL:'http://127.0.0.1:4173',timezoneId:'Europe/Warsaw',trace:'retain-on-failure',screenshot:'only-on-failure'},
  projects:[
    {name:'desktop-chrome',use:{...devices['Desktop Chrome'],viewport:{width:1440,height:900},...(process.env.GD1_TEST_CHROME_PATH?{launchOptions:{executablePath:process.env.GD1_TEST_CHROME_PATH}}:{})}},
    {name:'mobile-chrome',use:{...devices['Pixel 7'],...(process.env.GD1_TEST_CHROME_PATH?{launchOptions:{executablePath:process.env.GD1_TEST_CHROME_PATH}}:{})}},
    {name:'iphone-webkit',use:{...devices['iPhone 13']}}
  ],
  webServer:{command:`"${process.execPath}" tools/browser-server.mjs`,url:'http://127.0.0.1:4173',reuseExistingServer:false,timeout:15000}
});
