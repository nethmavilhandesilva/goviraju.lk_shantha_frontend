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

export const A4BillHTML = ({ salesData, billNo, customerName, mobile, globalLoanAmount = 0 }) => {
    const formatNumber = (num) => {
        if (typeof num !== 'number' && typeof num !== 'string') return '0';
        const number = parseFloat(num);
        if (isNaN(number)) return '0';
        return number.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const date = new Date().toLocaleDateString('si-LK');
    const time = new Date().toLocaleTimeString('si-LK', { hour: '2-digit', minute: '2-digit' });

    // Group by id to avoid duplicate CustomerPackCost
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
            total: itemTotal,
            supplier: s.supplier_code || ''
        });
    });

    const finalGrandTotal = totalSales + totalPackCost + totalKuliya + globalLoanAmount;

    // Show all items
    const itemsRows = itemsList.map(item => `
        <tr>
            <td style="padding: 3px 2px; text-align: center; font-size: 7px; border: 0.5px solid #000;">${item.id}</td>
            <td style="padding: 3px 2px; font-size: 7px; border: 0.5px solid #000;">
                ${item.name}<br>
                <span style="font-size: 6px;">${item.code}</span>
            </td>
            <td style="padding: 3px 2px; text-align: right; font-size: 7px; border: 0.5px solid #000;">${formatNumber(item.weight)}</td>
            <td style="padding: 3px 2px; text-align: right; font-size: 7px; border: 0.5px solid #000;">${formatNumber(item.price)}</td>
            <td style="padding: 3px 2px; text-align: center; font-size: 7px; border: 0.5px solid #000;">${item.packs}</td>
            <td style="padding: 3px 2px; text-align: right; font-size: 7px; border: 0.5px solid #000;">${formatNumber(item.total)}</td>
        </tr>
    `).join('');

    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Invoice - ${billNo}</title>
    <style>
        * { 
            margin: 0; 
            padding: 0; 
            box-sizing: border-box; 
        }
        body { 
            font-family: 'Iskoola Pota', 'Courier New', monospace; 
            background: white; 
            margin: 0;
            padding: 0;
            display: flex;
            justify-content: flex-start;
            align-items: flex-start;
            min-height: 100vh;
        }
        @media print { 
            body { 
                margin: 0; 
                padding: 0;
            } 
            @page { 
                size: A4;
                margin: 0.5cm;
            } 
        }
        /* Receipt style - fits in quarter of A4 but centered on page */
        .receipt-container { 
            width: 100%;
            max-width: 105mm;
            margin: 0;
            padding: 4mm;
            background: white;
            /* Remove absolute positioning */
            position: relative;
            top: auto;
            left: auto;
            font-size: 9px;
        }
        /* For print, ensure it starts at top-left */
        @media print {
            body {
                display: block;
            }
            .receipt-container {
                margin: 0;
                padding: 4mm;
                width: 100%;
                max-width: 105mm;
            }
        }
        /* ALL TEXT IS BLACK AND BOLD */
        div, span, p, td, th, strong, b {
            color: #000000 !important;
            font-weight: bold !important;
        }
        .header {
            text-align: center;
            border-bottom: 2px solid #000;
            padding-bottom: 4px;
            margin-bottom: 5px;
        }
        .shop-name {
            font-size: 12px;
            font-weight: bold;
            margin-bottom: 3px;
        }
        .shop-address {
            font-size: 7px;
            margin: 2px 0;
        }
        .shop-phone {
            font-size: 7px;
            margin: 2px 0;
        }
        .info-row {
            display: flex;
            justify-content: space-between;
            margin: 5px 0;
            font-size: 8px;
            flex-wrap: wrap;
            gap: 5px;
            padding: 3px;
            border: 0.5px solid #000;
        }
        .info-item {
            font-size: 8px;
        }
        .info-item strong {
            font-weight: bold;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 5px 0;
            font-size: 7px;
        }
        th {
            border: 0.5px solid #000;
            padding: 3px 2px;
            background: #f0f0f0;
            font-weight: bold;
            text-align: center;
            font-size: 7px;
        }
        td {
            border: 0.5px solid #000;
            padding: 3px 2px;
            text-align: left;
            font-size: 7px;
        }
        .text-center {
            text-align: center;
        }
        .text-right {
            text-align: right;
        }
        .totals-section {
            margin-top: 5px;
            width: 100%;
            border-top: 0.5px solid #ccc;
            padding-top: 4px;
        }
        .total-row {
            display: flex;
            justify-content: space-between;
            padding: 2px 0;
            font-size: 8px;
        }
        .net-total {
            display: flex;
            justify-content: space-between;
            padding: 4px 0;
            border-top: 2px solid #000;
            border-bottom: 2px solid #000;
            font-weight: bold;
            font-size: 9px;
            margin-top: 2px;
            background: #f9f9f9;
        }
        .footer {
            margin-top: 6px;
            text-align: center;
            font-size: 6px;
            border-top: 0.5px dashed #999;
            padding-top: 4px;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="receipt-container">
        <div class="header">
            <div class="shop-name">මහතුන් වෙළඳසැල</div>
            <div class="shop-address">දඹුල්ල විශේෂ ආර්ථික මධ්‍යස්ථානය</div>
            <div class="shop-phone">දුරකථන: 0777672838 / 0714371115</div>
        </div>
        
        <div class="info-row">
            <div class="info-item">කේතය: <strong>${customerName.toUpperCase()}</strong></div>
            <div class="info-item">බිල්පත් අංකය: <strong>${billNo}</strong></div>
            <div class="info-item">දිනය: <strong>${date}</strong></div>
        </div>

        <table>
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
                ${itemsRows}
            </tbody>
            <tfoot>
                <tr style="font-weight: bold; background: #f9f9f9;">
                    <td colspan="2"><strong>මුළු එකතුව</strong></td>
                    <td class="text-center"><strong>${formatNumber(totalSales)}</strong></td>
                    <td class="text-center"><strong>${totalPacks}</strong> මලු</td>
                    <td colspan="2"></td>
                </tr>
            </tfoot>
        </table>

        <div class="totals-section">
            <div class="total-row">
                <span>භාණ්ඩ එකතුව:</span>
                <span>රු. ${formatNumber(totalSales)}</span>
            </div>
            <div class="total-row">
                <span>මලු වියදම (Pack Cost):</span>
                <span>රු. ${formatNumber(totalPackCost)}</span>
            </div>
            ${totalKuliya > 0 ? `
            <div class="total-row">
                <span>කුලිය:</span>
                <span>රු. ${formatNumber(totalKuliya)}</span>
            </div>
            ` : ''}
            ${globalLoanAmount !== 0 ? `
            <div class="total-row">
                <span>පෙර ණය:</span>
                <span>රු. ${formatNumber(Math.abs(globalLoanAmount))}</span>
            </div>
            ` : ''}
            <div class="net-total">
                <span><strong>මුළු ගෙවිය යුතු මුදල:</strong></span>
                <span><strong>රු. ${formatNumber(finalGrandTotal)}</strong></span>
            </div>
        </div>
        
        <div class="footer">
            *** ස්තුතියි! නැවත පැමිණීමට සාදරයෙන් පිළිගනිමු ***
            <div>${date} | ${time}</div>
        </div>
    </div>
</body>
</html>`;
};