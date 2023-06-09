import puppeteer from "puppeteer";
import { appendFileSync } from "fs";

class Product {
    constructor(scrap_date = '', scrape_time = '', store_name = '', product_brand = '', product_name = '', product_url = '', product_image_url = '', 
        product_upc = '', product_model = '', manufacturer = '', product_price = 0, stock = 0 ) {
        this.scrap_date = scrap_date;
        this.scrape_time = scrape_time;
        this.store_name = store_name;
        this.product_brand = product_brand;
        this.product_name = product_name;
        this.product_url = product_url;
        this.product_image_url = product_image_url;
        this.product_upc = product_upc;
        this.product_model = product_model;
        this.product_price = product_price;
        this.manufacturer = manufacturer;
        this.stock = stock;
    }
    saveAsCSV() {
        var csv = `"${this.scrap_date}","${this.scrape_time}","${this.store_name}","${this.product_brand}","${this.product_name}","${this.product_url}","${this.product_image_url}","${this.product_upc}","${this.product_model}","${this.product_price}","${this.manufacturer}","${this.stock}"\n`;
        try {
            appendFileSync("./products.csv", csv);
        } catch (err) {
            console.error(err);
        }
    }
}

const startApp = (csvData) => {
    var header = new Product();
    header.saveAsCSV();
    for (var row of csvData) {
        var job = new Product(row['scrap_date'], row['scrape_time'], row['store_name'], row['product_brand'], row['product_name'], row['product_url'], row['product_image_url'], row['product_upc'], row['product_model'], row['product_price'], row['manufacturer'], row['stock']);
        job.saveAsCSV();
    }
}

const getQuotes = async () => {
    // Start a Puppeteer session with:
    var browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe'
    });

    // Open a new page
    var page = await browser.newPage();
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36';
    
    await page.setUserAgent(userAgent);
    // await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36')

    // On this new page:
    await page.goto("https://www.petcarerx.com/dog/food-nutrition/dry-food", {
        waitUntil: "load",
        timeout: 0,
    });
    var result = [];
    do {
        result = result.concat(await extractedProduct(page));
        if (result.length > 60){
            break;
        }
        await page.waitForSelector(".pagination > .page-item:last-child > a");
        let status = await page.evaluate(() => {
            if (document.querySelector(".pagination > .page-item:last-child").classList.length > 1) {
                return 0;
            }
            var next_btn = document.querySelector(".pagination > .page-item:last-child > a");
            if (next_btn){
                next_btn.click();
            }
            return 1;
        });
        if (status == 0) {
            break;
        }
        await page.waitForTimeout(5000);
    } while (1);

    var final_result = [];
    var lll = 0;
    for (var row of result){
        console.log(row.product_url);
        await page.goto(row.product_url, {
            waitUntil: "load",
            timeout: 0,
        });
        var product_details = await extractedProductDetail(page);
        for (var product_detail of product_details) {
            const now = new Date();
            const date = now.getDate();
            const month = now.getMonth() + 1;
            const year = now.getFullYear();
            const hours = now.getHours();
            const minutes = now.getMinutes();
            const seconds = now.getSeconds();

            final_result.push({
                'scrap_date': `${year}-${month}-${date}`,
                'scrape_time': `${hours}:${minutes}:${seconds}`,
                'store_name': 'Pet Care Rx',
                'product_brand': product_detail.product_brand,
                'product_name': product_detail.product_name,
                'product_url': row.product_url,
                'product_image_url': row.product_image_url,
                'product_upc': product_detail.product_upc,
                'product_model': '',
                'manufacturer': product_detail.manufacturer,
                'product_price': product_detail.product_price,
                'stock': product_detail.stock,
            })
        }
        if (lll > 30){
            break;
        }
        lll++;
    }
    // Close the browser
    await browser.close();
    startApp( final_result );
};

async function extractedProduct(page) {
    // Get page data
    var quotes = await page.evaluate(() => {
        var rows = document.querySelectorAll('.cake-product-carousel-item');
        return Array.from(rows).map((row) => {
            var product_url, product_name;
            var temp = row.querySelectorAll("a");
            product_url = temp[0].href;
            if (temp.length > 1){
                product_name = temp[1].innerHTML;
            } else {
                product_name = temp[0].innerHTML;
            }
            var product_image_url = row.querySelector("img").getAttribute('data-src');
            if (product_image_url == null) {
                product_image_url = row.querySelector("img").src;
            } else {
                product_image_url = 'https:' + product_image_url;
            }
            return { product_url, product_image_url, product_name };
        });
    });
    return quotes;
}

async function extractedProductDetail(page){
    var result = await page.evaluate(() => {
        var product_details_array = [];
        var product_brand;
        let temp = document.querySelectorAll('#accordionBody1 ul li span');
        temp = Array.from(temp).map((row) => {
            return row.innerText;
        });
        temp = temp.filter(row => row.indexOf('Brand') !== -1 );
        temp = temp.filter(row => row.indexOf('Brands') === -1 );
        if (temp.length > 0){
            product_brand = temp[0].slice(0, -6);
        } else {
            product_brand = '';
        }

        var product_name = document.querySelector('h1.cakepdp-product-title');
        if (product_name != null) {
            product_name = product_name.innerText;
        } else {
            product_name = '';
        }

        var manufacturer = document.querySelector('#accordionBody10 strong');
        if (manufacturer != null) {
            manufacturer = manufacturer.innerText;
        } else {
            manufacturer = '';
        }

        var option_upc_list = document.querySelectorAll('#accordionBody10 tbody tr');
        option_upc_list = Array.from(option_upc_list).map((row) => {
            var option = row.querySelector('td:first-child').innerText;
            var upc = row.querySelector('td[data-swiftype-name="upc"]').innerText;
            return {option, upc};
        });
        let num = option_upc_list.length;
        for (option_upc_row of option_upc_list) {
            if (num != 1) {
                let pos = option_upc_row.option.indexOf('Chicken');
                if (pos != -1) {
                    
                } else {
                    let temp = option_upc_row.option.split(', ');
                    if (temp.length > 1) {
                        let pos = temp[1].lastIndexOf(' ');
                        var option2 = temp[1].slice(0, pos);
                        document.querySelector('.sku-selector-container select').value = option2;
                        pos = temp[0].indexOf(' ');
                        var option1 = temp[0].slice(0, pos);
                        document.querySelector(`.cake-form-check input[type="radio"][value*="${option1}"]`).click();
                    } else {
                        // document.querySelector('.sku-selector-container select').value = temp;
                    }
                }
            }
            var product_price = document.querySelectorAll('small.fw-semibold:not(.text-white):not(.text-center)')[0].parentElement.parentElement.querySelector('span').innerText;
        
            var stock = document.querySelector('.cake-stock-indicator:not(.no-stock)');
            if (stock != null) {
                stock = 'Yes';
            } else {
                stock = 'No';
            }
            product_details_array.push({
                'product_brand': product_brand,
                'product_name': `${product_name} - ${option_upc_row.option}`,
                'product_upc': option_upc_row.upc,
                'manufacturer': manufacturer,
                'product_price': product_price,
                'stock': stock,
            });
        }
        return product_details_array;
    });
    return result;
}

getQuotes();