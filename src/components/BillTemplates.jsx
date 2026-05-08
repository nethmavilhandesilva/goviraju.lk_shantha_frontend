// src/components/BillTemplates.jsx

export const ThermalBillHTML = ({ salesData, billNo, customerName, mobile, globalLoanAmount = 0, billSize = '3inch' }) => {
    const formatNumber = (num) => {
        if (typeof num !== 'number' && typeof num !== 'string') return '0';
        const number = parseFloat(num);
        if (isNaN(number)) return '0';

        if (Number.isInteger(number)) {
            return number.toLocaleString('en-US');
        } else {
            const parts = number.toFixed(2).split('.');
            const wholePart = parseInt(parts[0]).toLocaleString('en-US');
            return `${wholePart}.${parts[1]}`;
        }
    };

    const date = new Date().toLocaleDateString();
    const time = new Date().toLocaleTimeString();

    const groupedById = new Map();
    salesData.forEach(s => {
        const id = s.id;
        if (!groupedById.has(id)) {
            groupedById.set(id, {
                ...s,
                weight: parseFloat(s.weight) || 0,
                price_per_kg: parseFloat(s.price_per_kg) || 0,
                packs: parseInt(s.packs) || 0,
                CustomerPackCost: parseFloat(s.CustomerPackCost) || 0,
                Kuliya: parseFloat(s.Kuliya) || 0
            });
        } else {
            const existing = groupedById.get(id);
            existing.weight += parseFloat(s.weight) || 0;
            existing.packs += parseInt(s.packs) || 0;
            existing.Kuliya += parseFloat(s.Kuliya) || 0;
        }
    });

    const uniqueSalesData = Array.from(groupedById.values());

    let totalSales = 0;
    let totalPackCost = 0;
    let totalKuliyaSum = 0;
    const consolidatedSummary = {};

    uniqueSalesData.forEach(s => {
        const itemName = s.item_name || 'Unknown';
        const weight = s.weight;
        const price = s.price_per_kg;
        const packs = s.packs;
        const packCost = s.CustomerPackCost;
        const kuliya = s.Kuliya;

        if (!consolidatedSummary[itemName]) consolidatedSummary[itemName] = { totalWeight: 0, totalPacks: 0 };
        consolidatedSummary[itemName].totalWeight += weight;
        consolidatedSummary[itemName].totalPacks += packs;

        totalSales += (weight * price);
        totalPackCost += (packs * packCost);
        totalKuliyaSum += kuliya;
    });

    const totalPacksSum = Object.values(consolidatedSummary).reduce((sum, item) => sum + item.totalPacks, 0);
    const finalGrandTotal = totalSales + totalPackCost + totalKuliyaSum;

    // Optimized for Epson TM-T81III (80mm width)
    const receiptMaxWidth = '280px'; // Slightly narrower than 350px to ensure no cutoff

    const itemsHtml = uniqueSalesData.map(s => {
        const weight = s.weight;
        const price = s.price_per_kg;
        const value = (weight * price).toFixed(2);

        return `
        <tr style="font-size:16px; font-weight: bold; color: #000;">
            <td style="text-align:left; padding:8px 0;">
                ${s.item_name || ""}<br>${formatNumber(s.packs)}
            </td>
            <td style="text-align:right; padding:8px 2px;">
                ${formatNumber(weight.toFixed(2))}
            </td>
            <td style="text-align:right; padding:8px 2px;">
                ${formatNumber(price.toFixed(2))}
            </td>
            <td style="text-align:right; padding:8px 0;">
                <div style="font-size:20px;">${s.supplier_code || "ASW"}</div>
                <div>${formatNumber(value)}</div>
            </td>
        </tr>`;
    }).join("");

    const summaryEntries = Object.entries(consolidatedSummary);
    let summaryHtmlContent = '';
    for (let i = 0; i < summaryEntries.length; i += 2) {
        const [n1, d1] = summaryEntries[i];
        const [n2, d2] = summaryEntries[i + 1] || [null, null];
        summaryHtmlContent += `
        <tr>
            <td style="padding:4px; font-weight:bold;">${n1}:${formatNumber(d1.totalWeight)}/${d1.totalPacks}</td>
            <td style="padding:4px; font-weight:bold;">${d2 ? `${n2}:${formatNumber(d2.totalWeight)}/${d2.totalPacks}` : ''}</td>
        </tr>`;
    }

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Arial', sans-serif; background: white; }
            .receipt-main { width: ${receiptMaxWidth}; margin: 0 auto; padding: 5px; }
            @media print {
                @page { margin: 0; size: 80mm auto; }
                body { width: 80mm; }
            }
            .header { text-align: center; }
            .badge { border: 2px solid #000; padding: 4px 8px; font-size: 18px; font-weight: bold; }
            .info-section { font-size: 16px; margin-top: 10px; }
            hr { border: none; border-top: 2px solid #000; margin: 8px 0; }
            table { width: 100%; border-collapse: collapse; }
            .total-table { margin-top: 15px; font-weight: bold; font-size: 20px; }
        </style>
    </head>
    <body>
        <div class="receipt-main">
            <div class="header">
                <div style="font-size: 22px; font-weight: bold;">මහතුන් වෙළඳසැල</div>
                <div style="margin: 10px 0;">
                    <span class="badge">F2-1</span>
                    <span class="badge">${customerName.toUpperCase()}</span>
                </div>
                <div style="font-size: 14px; font-weight: bold;">විශේෂ ආර්ථික මධ්‍යස්ථානය දඹුල්ල</div>
            </div>

            <div class="info-section">
                <div style="font-weight: bold; font-size: 14px;">Tel: 0777672838 / 0714371115</div>
                <div style="display:flex; justify-content:space-between; font-size: 13px; margin-top: 5px;">
                    <span>බිල් අංකය: ${billNo}</span>
                    <div style="text-align:right;">
                        <span style="white-space:nowrap;">දිනය: ${date}</span><br>
                        <span>${time}</span>
                    </div>
                </div>
            </div>

            <hr />

            <table>
                <colgroup>
                    <col style="width:30%;">
                    <col style="width:20%;">
                    <col style="width:20%;">
                    <col style="width:30%;">
                </colgroup>
                <thead>
                    <tr style="border-bottom:2px solid #000; font-weight:bold; font-size:14px;">
                      <th style="text-align:left;">
                       වර්ගය<br>මලු
                       </th>
                        <th style="text-align:right;">කිලෝ</th>
                        <th style="text-align:right;">මිල</th>
                        <th style="text-align:right;">අගය</th>
                    </tr>
                </thead>
                <tbody>${itemsHtml}</tbody>
                <tfoot>
                    <tr style="border-top:2px solid #000;">
                        <td colspan="4" style="padding-top:10px;">
                            <div style="display:flex; justify-content:space-between; font-size:24px; font-weight:bold;">
                                <span>${formatNumber(totalPacksSum)}</span>
                                <span>${Number(totalSales).toFixed(2)}</span>
                            </div>
                        </td>
                    </tr>
                </tfoot>
            </table>

            <table class="total-table">
                ${totalPackCost > 0 ? `<tr><td>මලු:</td><td style="text-align:right;">${formatNumber(totalPackCost.toFixed(2))}</td></tr>` : ''}
                ${totalKuliyaSum > 0 ? `<tr><td>කුලිය:</td><td style="text-align:right;">${formatNumber(totalKuliyaSum.toFixed(2))}</td></tr>` : ''}
                <tr>
                    <td style="padding-top:10px;">එකතුව:</td>
                    <td style="text-align:right; padding-top:10px;">
                        <span style="border-bottom:4px double #000; border-top:1px solid #000; font-size:26px;">
                            ${Number(finalGrandTotal).toFixed(2)}
                        </span>
                    </td>
                </tr>
                ${globalLoanAmount !== 0 ? `
                <tr>
                    <td style="font-size:18px; padding-top:10px;">පෙර ණය:</td>
                    <td style="text-align:right; font-size:20px; padding-top:10px;">
                        Rs. ${formatNumber(Math.abs(globalLoanAmount).toFixed(2))}
                    </td>
                </tr>` : ''}
            </table>

            <div style="margin-top:20px; border-top:1px dashed #000; padding-top:10px;">
                <table style="font-size:12px;">
                    <tbody>${summaryHtmlContent}</tbody>
                </table>
            </div>
        </div>
    </body>
    </html>`;
};

// src/components/BillTemplates.jsx

export const A4BillHTML = ({ salesData, billNo, customerName, mobile, globalLoanAmount = 0, billWidth = '150mm', topMargin = '15mm' }) => {
    const formatNumber = (num) => {
        if (typeof num !== 'number' && typeof num !== 'string') return '0.00';
        const number = parseFloat(num);
        if (isNaN(number)) return '0.00';
        return number.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const date = new Date().toLocaleDateString('si-LK');
    const time = new Date().toLocaleTimeString('si-LK', { hour: '2-digit', minute: '2-digit' });

    const groupedById = new Map();
    salesData.forEach(s => {
        const id = s.id;
        if (!groupedById.has(id)) {
            groupedById.set(id, {
                ...s,
                weight: parseFloat(s.weight) || 0,
                price_per_kg: parseFloat(s.price_per_kg) || 0,
                packs: parseInt(s.packs) || 0,
                CustomerPackCost: parseFloat(s.CustomerPackCost) || 0,
                Kuliya: parseFloat(s.Kuliya) || 0
            });
        } else {
            const existing = groupedById.get(id);
            existing.weight += parseFloat(s.weight) || 0;
            existing.packs += parseInt(s.packs) || 0;
            existing.Kuliya += parseFloat(s.Kuliya) || 0;
        }
    });

    const uniqueSalesData = Array.from(groupedById.values());

    let totalSales = 0;
    let totalPacks = 0;
    let totalPackCost = 0;
    let totalKuliya = 0;
    const itemsList = [];

    uniqueSalesData.forEach((s, index) => {
        const weight = s.weight;
        const price = s.price_per_kg;
        const packs = s.packs;
        const packCost = s.CustomerPackCost;
        const kuliya = s.Kuliya;
        const itemTotal = weight * price;

        totalSales += itemTotal;
        totalPacks += packs;
        totalPackCost += packs * packCost;
        totalKuliya += kuliya;

        itemsList.push({
            id: index + 1,
            name: s.item_name || 'Unknown',
            code: s.item_code || '',
            weight: weight,
            price: price,
            packs: packs,
            total: itemTotal
        });
    });

    const finalGrandTotal = totalSales + totalPackCost + totalKuliya + globalLoanAmount;

    // Calculate font sizes and padding based on bill width
    const getStyles = (width) => {
        const widthNum = parseInt(width);
        
        let headerFontSize, shopFontSize, normalFontSize, smallFontSize, tinyFontSize;
        
        if (widthNum <= 58) {
            headerFontSize = '18px';
            shopFontSize = '13px';
            normalFontSize = '13px';
            smallFontSize = '12px';
            tinyFontSize = '11px';
        } else if (widthNum <= 80) {
            headerFontSize = '22px';
            shopFontSize = '15px';
            normalFontSize = '15px';
            smallFontSize = '14px';
            tinyFontSize = '13px';
        } else {
            headerFontSize = '28px';
            shopFontSize = '18px';
            normalFontSize = '16px';
            smallFontSize = '15px';
            tinyFontSize = '14px';
        }
        
        return {
            containerWidth: width,
            headerFontSize,
            shopFontSize,
            normalFontSize,
            smallFontSize,
            tinyFontSize,
            padding: widthNum <= 58 ? '4mm' : '5mm'
        };
    };
    
    const styles = getStyles(billWidth);

    // Split items into pages with 9 items per page
    const ITEMS_PER_PAGE = 9;
    
    const splitItemsIntoPages = (items, itemsPerPage = 9) => {
        const pages = [];
        for (let i = 0; i < items.length; i += itemsPerPage) {
            pages.push(items.slice(i, i + itemsPerPage));
        }
        return pages;
    };
    
    const itemPages = splitItemsIntoPages(itemsList, ITEMS_PER_PAGE);

    // Generate HTML for each page
    const generatePage = (pageItems, pageNumber, isLastPage) => {
        const pageItemsRows = pageItems.map((item) => {
            return `
                <tr style="page-break-inside: avoid;">
                    <td style="text-align: center; padding: 8px 4px; font-size: 20px;">${item.id}</td>
                    <td style="padding: 8px 4px; font-size: 16px;">${item.name}<br><span style="font-size: 20px;">${item.code}</span></td>
                    <td class="text-right" style="padding: 8px 4px; font-size: 20px;">${formatNumber(item.weight)}</td>
                    <td class="text-right" style="padding: 8px 4px; font-size: 20px;">${formatNumber(item.price)}</td>
                    <td class="text-center" style="padding: 8px 4px; font-size: 20px;">${item.packs}</td>
                    <td class="text-right" style="padding: 8px 4px; font-size: 20px;">${formatNumber(item.total)}</td>
                </tr>
            `;
        }).join('');

        // Calculate page-specific totals
        let pageTotalSales = 0;
        let pageTotalPacks = 0;
        pageItems.forEach(item => {
            pageTotalSales += item.total;
            pageTotalPacks += item.packs;
        });

        return `
            <div class="receipt-container" style="page-break-after: ${isLastPage ? 'avoid' : 'always'};">
                ${pageNumber === 1 ? `
                <div class="header">
                    <div class="shop-name">මහතුන් වෙළඳසැල</div>
                    <div class="shop-address">දඹුල්ල විශේෂ ආර්ථික මධ්‍යස්ථානය</div>
                    <div class="shop-phone">දුරකථන: 0777672838 / 0714371115</div>
                </div>
                
                <div class="info-row">
                    <div>කේතය: ${(customerName || '').toUpperCase()}</div>
                    <div>අංකය: ${billNo}</div>
                    <div>දිනය: ${date}</div>
                </div>
                ` : `
                <div class="header-continued">
                    <div class="continued-label">(පිටුව ${pageNumber} / ${itemPages.length} - කරුණාකර දිගටම කියවන්න)</div>
                </div>
                `}

                ${itemPages.length > 1 ? `
                <div style="margin-bottom: 5px; font-size: 12px; text-align: center; font-weight: bold;">
                    පිටුව ${pageNumber} / ${itemPages.length}
                </div>
                ` : ''}

                <table>
                    <colgroup>
                        <col style="width: 8%">
                        <col style="width: 32%">
                        <col style="width: 15%">
                        <col style="width: 15%">
                        <col style="width: 10%">
                        <col style="width: 20%">
                    </colgroup>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>අයිතමය</th>
                            <th>බර(kg)</th>
                            <th>මිල</th>
                            <th>මලු</th>
                            <th>එකතුව</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${pageItemsRows || ''}
                    </tbody>
                    <tfoot>
                        <tr style="background: #f0f0f0;">
                            <td colspan="2" style="font-size: ${styles.normalFontSize}; font-weight: bold;">මෙම පිටුවේ එකතුව</td>
                            <td class="text-right" style="font-size: ${styles.normalFontSize}; font-weight: bold;">${formatNumber(pageTotalSales)}</td>
                            <td style="font-size: ${styles.normalFontSize}; font-weight: bold;"></td>
                            <td class="text-center" style="font-size: ${styles.normalFontSize}; font-weight: bold;">${pageTotalPacks}</td>
                            <td style="font-size: ${styles.normalFontSize}; font-weight: bold;"></td>
                        </tr>
                    </tfoot>
                </table>

                ${isLastPage ? `
                <div class="totals-section">
                    <div class="total-row"><span>භාණ්ඩ එකතුව:</span><span>රු. ${formatNumber(totalSales)}</span></div>
                    <div class="total-row"><span>මලු වියදම:</span><span>රු. ${formatNumber(totalPackCost)}</span></div>
                    ${totalKuliya > 0 ? `<div class="total-row"><span>කුලිය:</span><span>රු. ${formatNumber(totalKuliya)}</span></div>` : ''}
                    ${globalLoanAmount !== 0 ? `<div class="total-row"><span>පෙර ණය:</span><span>රු. ${formatNumber(Math.abs(globalLoanAmount))}</span></div>` : ''}
                    <div class="net-total">
                        <span>මුළු ගෙවිය යුතු මුදල:</span>
                        <span>රු. ${formatNumber(finalGrandTotal)}</span>
                    </div>
                </div>
                
                <div class="footer">
                    *** ස්තුතියි! නැවත පැමිණෙන්න ***
                    <div style="margin-top: 5px; font-size: ${styles.tinyFontSize};">${date} | ${time}</div>
                </div>
                ` : `
                <div class="footer" style="margin-top: 15px; text-align: center; font-size: ${styles.smallFontSize}; border-top: 2px dashed #000; padding-top: 10px;">
                    *** කරුණාකර පහත පිටුවට හැරෙන්න ***
                </div>
                `}
            </div>
        `;
    };

    // Generate all pages
    let allPagesHTML = '';
    if (itemsList.length === 0) {
        // Single page with no items
        allPagesHTML = `
            <div class="receipt-container">
                <div class="header">
                    <div class="shop-name">මහතුන් වෙළඳසැල</div>
                    <div class="shop-address">දඹුල්ල විශේෂ ආර්ථික මධ්‍යස්ථානය</div>
                    <div class="shop-phone">දුරකථන: 0777672838 / 0714371115</div>
                </div>
                
                <div class="info-row">
                    <div>කේතය: ${(customerName || '').toUpperCase()}</div>
                    <div>අංකය: ${billNo}</div>
                    <div>දිනය: ${date}</div>
                </div>
                
                <div style="text-align: center; padding: 40px; font-size: 20px; font-weight: bold;">
                    අයිතම නොමැත
                </div>
                
                <div class="footer">
                    *** ස්තුතියි! නැවත පැමිණෙන්න ***
                    <div style="margin-top: 5px; font-size: ${styles.tinyFontSize};">${date} | ${time}</div>
                </div>
            </div>
        `;
    } else {
        itemPages.forEach((page, idx) => {
            allPagesHTML += generatePage(page, idx + 1, idx === itemPages.length - 1);
        });
    }

    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; -webkit-print-color-adjust: exact; }
        
        body { 
            font-family: 'Iskoola Pota', Arial, sans-serif; 
            background: #f0f0f0; 
            padding: 0;
            margin: 0;
        }

        .receipt-container { 
            width: ${styles.containerWidth}; 
            max-width: 100%;
            background: white;
            padding: ${styles.padding};
            margin: ${topMargin} auto 0 auto;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
            page-break-after: always;
            page-break-inside: avoid;
        }

        @media print {
            body { 
                background: white; 
                padding: 0; 
                margin: 0;
            }
            .receipt-container { 
                box-shadow: none; 
                margin: ${topMargin} auto 0 auto !important;
                page-break-after: always;
                page-break-inside: avoid;
            }
            @page { 
                size: ${styles.containerWidth} auto;
                margin: 0;
            }
        }

        div, span, p, td, th, strong, .shop-name, .shop-address, .shop-phone, 
        .info-row, .total-row, .net-total, .footer, .header-continued { 
            color: #000 !important; 
            font-weight: bold !important; 
        }

        .header { 
            text-align: center; 
            border-bottom: 3px solid #000; 
            padding-bottom: 10px; 
            margin-bottom: 10px; 
        }
        
        .header-continued {
            text-align: center;
            border-bottom: 2px solid #000;
            padding-bottom: 8px;
            margin-bottom: 10px;
        }
        
        .continued-label {
            font-size: 14px;
            font-weight: bold;
            color: #333;
        }
        
        .shop-name { 
            font-size: ${styles.headerFontSize}; 
            margin-bottom: 5px; 
            font-weight: bold;
        }
        .shop-address, .shop-phone { 
            font-size: ${styles.shopFontSize}; 
            margin: 3px 0; 
            font-weight: bold;
        }

        .info-row { 
            display: flex; 
            justify-content: space-between; 
            margin-bottom: 10px; 
            padding: 8px; 
            border: 2px solid #000; 
            font-size: ${styles.normalFontSize};
            font-weight: bold;
        }

        table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-bottom: 10px;
            table-layout: fixed;
        }
        
        th { 
            border: 2px solid #000; 
            padding: 8px 4px; 
            background: #eee; 
            font-size: ${styles.smallFontSize};
            font-weight: bold;
        }
        
        td { 
            border: 1px solid #000; 
            padding: 8px 4px; 
            font-size: ${styles.normalFontSize};
            vertical-align: top;
            font-weight: bold;
        }

        .text-right { text-align: right; }
        .text-center { text-align: center; }

        .totals-section { 
            margin-top: 10px; 
            border-top: 2px solid #000; 
            padding-top: 10px;
        }
        
        .total-row { 
            display: flex; 
            justify-content: space-between; 
            padding: 6px 0; 
            font-size: ${parseInt(styles.normalFontSize) + 2}px;
            font-weight: bold;
        }
        
        .net-total { 
            display: flex; 
            justify-content: space-between; 
            padding: 10px 5px; 
            border-top: 3px solid #000; 
            border-bottom: 3px solid #000;
            font-size: ${parseInt(styles.normalFontSize) + 6}px;
            margin-top: 8px; 
            background: #f9f9f9;
            font-weight: bold;
        }

        .footer { 
            margin-top: 15px; 
            text-align: center; 
            font-size: ${styles.smallFontSize}; 
            border-top: 2px dashed #000; 
            padding-top: 10px; 
            font-weight: bold;
        }
    </style>
</head>
<body>
    ${allPagesHTML}
</body>
</html>`;
};

