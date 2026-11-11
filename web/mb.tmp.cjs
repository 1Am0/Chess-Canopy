const { chromium } = require('@playwright/test');
const out = process.argv[2];
(async () => {
  const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH });
  for (const [n, vp] of [['m390',{width:390,height:844}],['m320',{width:320,height:640}],['d1440',{width:1440,height:900}]]) {
    const ctx = await b.newContext({ viewport: vp });
    const p = await ctx.newPage();
    await p.goto('http://localhost:3100/'); await p.waitForTimeout(800);
    await p.getByRole('tab', { name: 'JSON' }).click();
    await p.getByLabel('Drop a JSON file exported by the Python CLI').setInputFiles('/home/user/Chess-Canopy/web/tests/fixtures/golden/sample_games.json');
    await p.getByLabel(/Player label/).fill('tester');
    await p.getByRole('button', { name: 'Import games' }).click();
    await p.getByRole('grid').waitFor(); await p.waitForTimeout(500);
    await p.screenshot({ path: `${out}-${n}-header.png`, clip:{x:0,y:0,width:vp.width,height:200} });
    if (n!=='d1440') { await p.getByRole('button',{name:'More options'}).click(); await p.waitForTimeout(400);
      await p.screenshot({ path: `${out}-${n}-menu.png`, clip:{x:0,y:0,width:vp.width,height:300} }); await p.keyboard.press('Escape'); }
    await p.getByRole('button',{name:/^Filters/}).click(); await p.waitForTimeout(500);
    await p.keyboard.press('Escape');
    await p.getByRole('button',{name:'Copy FEN'}).first().click().catch(()=>{});
    await p.waitForTimeout(600);
    await p.screenshot({ path: `${out}-${n}-toast.png` });
    await ctx.close();
  }
  await b.close();
})();
