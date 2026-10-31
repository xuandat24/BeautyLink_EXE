import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);const { chromium }=require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const browser=await chromium.launch({headless:true});const base=process.env.BEAUTYLINK_SMOKE_URL || 'http://localhost:5173';
try {
  for(const [width,height] of [[1366,768],[390,844]]) {
    const context=await browser.newContext({viewport:{width,height}});const page=await context.newPage();const errors=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().includes('/api/v1/')&&r.status()>=500)errors.push(`HTTP ${r.status()}`);});
    await page.goto(`${base}/#login`);await page.locator('#customer-identifier').fill('0901234599');await page.locator('#customer-password').fill('Synthetic Admin123!');await page.getByRole('button',{name:'Đăng nhập ngay',exact:true}).click();await page.getByTestId('admin-overview').waitFor();
    let loads=0;page.on('domcontentloaded',()=>loads++);
    const nav=async label=>{if(width<1024)await page.getByRole('button',{name:'Mở menu quản trị',exact:true}).click();await page.getByRole('navigation',{name:'Điều hướng quản trị'}).getByRole('button',{name:label,exact:true}).click();};
    await nav('Người dùng');await page.locator('tbody tr').first().waitFor();
    const role=page.getByRole('combobox',{name:'Lọc vai trò'});await role.selectOption('CUSTOMER');await page.getByRole('columnheader',{name:'STT',exact:true}).waitFor();
    await page.waitForFunction(()=>document.querySelector('tbody tr td')?.textContent==='1');
    const names=await page.locator('tbody tr td:nth-child(2)').allTextContents();const collator=new Intl.Collator('vi',{sensitivity:'base',numeric:true});assert.deepEqual(names,[...names].sort(collator.compare));
    await page.getByRole('button',{name:'Trang sau',exact:true}).click();await page.waitForFunction(()=>document.querySelector('tbody tr td')?.textContent==='21');
    const second=await page.locator('tbody tr td:nth-child(2)').allTextContents();assert.ok(collator.compare(names.at(-1),second[0])<=0);
    const search=page.getByRole('textbox',{name:'Tìm người dùng'});await search.fill('phandinhkhoi');await page.waitForFunction(()=>document.querySelectorAll('tbody tr').length===1&&document.querySelector('tbody tr td')?.textContent==='1');
    assert.equal(await page.locator('tbody tr td:nth-child(2)').textContent(),'Phan Dinh Khoi');assert.match(await page.locator('tbody tr td:nth-child(3)').textContent(),/^[a-z0-9]+@gmail\.com$/);
    const alias=await page.locator('tbody tr td:nth-child(3)').textContent();await page.getByRole('button',{name:'Xem chi tiết',exact:true}).click();await page.getByRole('heading',{name:'Phan Dinh Khoi',exact:true}).waitFor();assert.ok((await page.locator('main').textContent()).includes(alias));
    assert.equal(loads,0,'SPA filters/details never reload document');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
    await page.screenshot({path:`backend/target/admin-display-${width}-detail.png`,fullPage:true});
    await nav('Đối tác/Salon');await page.getByRole('columnheader',{name:'STT',exact:true}).waitFor();await page.locator('tbody tr').first().waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);await page.screenshot({path:`backend/target/admin-display-${width}-salons.png`,fullPage:true});
    assert.deepEqual(errors,[]);await context.close();console.log(`PASS display profiles ${width}: A–Z across pages, STT1/21/reset, stable aliases/detail, SPA, overflow, console`);
  }
}finally{await browser.close();}
