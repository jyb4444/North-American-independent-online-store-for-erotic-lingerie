import {test,expect,signIn} from './fixtures';
import {USERS} from '../helpers/seed';
import {admin} from '../helpers/supabase';
import {MOCK_PRODUCTS} from '../../src/mock/products';

test('new review stays pending for its author and hidden from another browser',async({page,browser})=>{
 const product=MOCK_PRODUCTS[0];const text='A new browser review awaiting actual moderation';
 await signIn(page,USERS.alice);await page.goto(`/products/${product.handle}`);
 await page.getByRole('button',{name:'Write a Review',exact:true}).click();
 await page.getByRole('button',{name:'Rate 5 stars',exact:true}).click();
 await page.getByPlaceholder('What should other shoppers know about fit, fabric, comfort, quality, or sizing?').fill(text);
 await page.getByRole('button',{name:'Submit Review',exact:true}).click();
 await expect(page.getByText(text,{exact:true})).toBeVisible();await expect(page.getByText('Pending approval',{exact:true})).toBeVisible();
 const {data}=await admin().from('reviews').select('id,approved').eq('product_id',product.id).eq('body',text);expect(data?.[0].approved).toBe(false);
 const context=await browser.newContext();await context.addCookies([{name:'velour_age_verified',value:'1',domain:'localhost',path:'/'}]);const other=await context.newPage();
 try {await other.goto(`/products/${product.handle}`);await expect(other.getByText(text,{exact:true})).toHaveCount(0);}finally{await context.close();if(data?.[0])await admin().from('reviews').delete().eq('id',data[0].id);}
});
