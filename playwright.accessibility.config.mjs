import base from './playwright.config.mjs';
import {defineConfig} from 'playwright/test';
export default defineConfig({...base,testDir:'./tests/accessibility',timeout:60000,projects:base.projects.filter(p=>['desktop-chrome','mobile-chrome'].includes(p.name)),reporter:[['list'],['html',{outputFolder:'accessibility-report',open:'never'}]],outputDir:'accessibility-results'});
