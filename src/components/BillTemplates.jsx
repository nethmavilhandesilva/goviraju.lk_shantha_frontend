// src/components/BillTemplates.jsx

// Thermal Bill Template (3-inch)
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

    // Calculate aggregated totals
    let totalSales = 0;
    let totalPacks = 0;
    let totalPackCost = 0;
    let totalKuliyaSum = 0;
    const consolidatedSummary = {};

    salesData.forEach(s => {
        const itemName = s.item_name || 'Unknown';
        const weight = parseFloat(s.weight) || 0;
        const price = parseFloat(s.price_per_kg) || 0;
        const packs = parseInt(s.packs) || 0;
        
        // 🔧 FIXED: CustomerPackCost is already the TOTAL cost for this item
        // No need to multiply by packs again!
        const packCost = parseFloat(s.CustomerPackCost) || 0;
        const kuliya = parseFloat(s.Kuliya) || 0;

        if (!consolidatedSummary[itemName]) consolidatedSummary[itemName] = { totalWeight: 0, totalPacks: 0 };
        consolidatedSummary[itemName].totalWeight += weight;
        consolidatedSummary[itemName].totalPacks += packs;

        totalSales += (weight * price);
        totalPacks += packs;
        
        // 🔧 FIXED: Use packCost directly, don't multiply by packs again
        totalPackCost += packCost;
        totalKuliyaSum += kuliya;
    });

    const totalPacksSum = Object.values(consolidatedSummary).reduce((sum, item) => sum + item.totalPacks, 0);
    const finalGrandTotal = totalSales + totalPackCost + totalKuliyaSum;

    const is4Inch = billSize === '4inch';
    const receiptMaxWidth = is4Inch ? '4in' : '350px';

    const fontSizeBody = '18px';
    const fontSizeHeader ='18px';
    const fontSizeTotal = '28px';

    const colGroups = `
    <colgroup>
        <col style="width:32%;"> 
        <col style="width:21%;">
        <col style="width:21%;">
        <col style="width:26%;">
    </colgroup>`;

    const itemsHtml = salesData.map(s => {
        const packs = parseInt(s.packs) || 0;
        const weight = parseFloat(s.weight) || 0;
        const price = parseFloat(s.price_per_kg) || 0;
        const value = (weight * price).toFixed(2);

        return `
      <tr style="font-size:${fontSizeBody}; font-weight: 900; vertical-align: bottom; color: #000000; font-weight: bold; -webkit-text-stroke: 0.5px #000000;">
            <td style="font-size:20px; text-align:left; padding:10px 0; white-space: nowrap;">
                ${s.item_name || ""}<br>${formatNumber(packs)}
            </td>
            <td style="text-align:right; padding:10px 2px; position: relative; left: -70px;">
                ${formatNumber(weight.toFixed(2))}
            </td>
            <td style="text-align:right; padding:10px 2px; position: relative; left: -55px;">
                ${formatNumber(price.toFixed(2))}
            </td>
            <td style="padding:10px 0; display:flex; flex-direction:column; align-items:flex-end;">
                <div style="font-size:25px; white-space:nowrap;">${s.supplier_code || "ASW"}</div>
                <div style="font-weight:900; white-space:nowrap;">${formatNumber(value)}</div>
            </td>
        </tr>`;
    }).join("");

    const kuliyaRow = totalKuliyaSum > 0 ? `
    <tr>
        <td style="font-size:20px;">කුලිය:</td>
        <td style="text-align:right; font-weight:bold;">${formatNumber(totalKuliyaSum.toFixed(2))}</td>
    </tr>
    ` : '';

    const loanRow = globalLoanAmount !== 0 ? `
    <tr>
        <td style="font-size:20px; padding-top:8px;">පෙර ණය:</td>
        <td style="text-align:right; font-size:22px; font-weight:bold; padding-top:8px;">
            Rs. ${formatNumber(Math.abs(globalLoanAmount).toFixed(2))}
        </td>
    </tr>
    ` : '';

    const summaryEntries = Object.entries(consolidatedSummary);
    let summaryHtmlContent = '';
    for (let i = 0; i < summaryEntries.length; i += 2) {
        const [name1, d1] = summaryEntries[i];
        const [name2, d2] = summaryEntries[i + 1] || [null, null];
        const text1 = `${name1}:${formatNumber(d1.totalWeight)}/${formatNumber(d1.totalPacks)}`;
        const text2 = d2 ? `${name2}:${formatNumber(d2.totalWeight)}/${formatNumber(d2.totalPacks)}` : '';
        summaryHtmlContent += `
        <tr>
            <td style="padding:6px; width:50%; font-weight:bold; white-space:nowrap;">${text1}</td>
            <td style="padding:6px; width:50%; font-weight:bold; white-space:nowrap;">${text2}</td>
        </tr>`;
    }

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Invoice - ${billNo}</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { margin: 0; padding: 0; font-family: 'Courier New', monospace; background: white; }
            .receipt-main { width: ${receiptMaxWidth}; margin: 0 auto; padding: 10px; background: #fff; color: #000; }
            @media print {
                @page { margin: 0; size: auto; }
                body { margin: 0 !important; padding: 0 !important; background: white !important; }
                .receipt-main { margin: 0 !important; padding: 8px !important; }
            }
            @media screen { body { background: #e5e7eb; display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 20px; } }
            .header { text-align: center; font-weight: bold; }
            .business-name { font-size: 24px; }
            .business-sub { font-size: 12px; margin-bottom: 5px; }
            .customer-badge { display: flex; justify-content: center; align-items: center; gap: 15px; margin: 12px 0; }
            .badge { border: 2.5px solid #000; padding: 5px 12px; font-size: 22px; }
            .time-row { display: flex; justify-content: space-between; font-size: 14px; margin-top: 6px; padding: 0 5px; }
            .info-section { font-size: 19px; margin-top: -12px; padding: 0 5px; }
            .info-row { display: flex; justify-content: space-between; margin-top: 3px; }
            hr { border: none; border-top: 2.5px solid #000; margin: 10px 0; }
            table { width: 100%; border-collapse: collapse; table-layout: fixed; }
            th { text-align: left; padding-bottom: 8px; font-size: ${fontSizeHeader}; }
            .total-table { width: 100%; margin-top: 20px; font-weight: bold; font-size: 22px; padding: 0 5px; }
            .summary-grid { margin-top: 25px; border-top: 1px dashed #000; padding-top: 10px; }
            .right { display: flex; flex-direction: column; align-items: flex-end; }
            .info-row .time { font-size: 14px; margin-top: 2px; }
        </style>
    </head>
    <body>
        <div class="receipt-main">
            <div class="header">
                <div class="business-name">මහතුන් වෙළඳසැල</div>
                <div class="customer-badge">
                    <span class="badge">F2-1</span>
                    <span class="badge">${customerName.toUpperCase()}</span>
                </div>
                <div class="time-row">
                    <div class="business-sub" style="font-size: 16px; font-weight: bold;">විශේෂ ආර්ථික මධ්‍යස්ථානය දඹුල්ල</div>
                </div>
            </div>
            <div class="info-section">
                <div style="font-weight: bold;">දුර: 0777672838 / 0714371115</div>
               <div class="info-row" style="display:flex; justify-content:space-between; align-items:center; width:100%;">
                  <div class="left" style="display:flex; gap:15px;">
                      <span>බිල් අංකය: ${billNo}</span>
                  </div>
                  <div class="right" style="display:flex; flex-direction:column; align-items:flex-end; gap:2px; margin-left:auto;">
                      <span style="white-space:nowrap;">දිනය: ${date}</span>
                      <span class="time">${time}</span>
                  </div>
                </div>
            </div>
            <hr />
            <table>
                ${colGroups}
                <thead>
                    <tr style="border-bottom:2.5px solid #000; font-weight:bold;">
                        <th style="text-align:left; font-size:${fontSizeHeader};">වර්ගය<br />මලු</th>
                        <th style="text-align:left; font-size:${fontSizeHeader}; position: relative; left: -35px;">කිලෝ</th>
                        <th style="text-align:right; font-size:${fontSizeHeader};position: relative; left: -34px;">මිල</th>
                        <th style="text-align:right; font-size:${fontSizeHeader};">අයිතිය<br />අගය</th>
                    </tr>
                </thead>
                <tbody>${itemsHtml}</tbody>
                <tfoot>
                    <tr style="border-top:2.5px solid #000; font-weight:bold;">
                        <td style="padding-top:12px; font-size:${fontSizeTotal};">${formatNumber(totalPacksSum)}</td>
                        <td colspan="3" style="padding-top:12px; font-size:${fontSizeTotal};">
                            <div style="text-align:right; white-space:nowrap;">${Number(totalSales).toFixed(2)}</div>
                        </td>
                    </tr>
                </tfoot>
            </table>
            <table class="total-table">
                ${totalPackCost > 0 ? `
                <tr>
                    <td style="font-size:20px;">මලු:</td>
                    <td style="text-align:right; font-weight:bold;">${formatNumber(totalPackCost.toFixed(2))}</td>
                </tr>
                ` : ''}
                ${kuliyaRow}
                <tr>
                    <td style="font-size:20px; padding-top:8px;">එකතුව:</td>
                    <td style="text-align:right; padding-top:8px;">
                        <span style="border-bottom:5px double #000; border-top:2px solid #000; font-size:${fontSizeTotal}; padding:5px 10px;">
                            ${Number(finalGrandTotal).toFixed(2)}
                        </span>
                    </td>
                </tr>
                ${loanRow}
            </table>
            <div class="summary-grid">
                <table style="width:100%; border-collapse:collapse; font-size:14px; text-align:center;">
                    <tbody>${summaryHtmlContent}</tbody>
                </table>
            </div>
        </div>
    </body>
    </html>`;
};

// Also fix the A4BillHTML template
export const A4BillHTML = ({ salesData, billNo, customerName, mobile, globalLoanAmount = 0 }) => {
    const formatNumber = (num) => {
        if (typeof num !== 'number' && typeof num !== 'string') return '0';
        const number = parseFloat(num);
        if (isNaN(number)) return '0';
        return number.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const date = new Date().toLocaleDateString('si-LK');
    const time = new Date().toLocaleTimeString('si-LK', { hour: '2-digit', minute: '2-digit' });

    let totalSales = 0;
    let totalPacks = 0;
    let totalPackCost = 0;
    const itemsList = [];

    salesData.forEach((s, index) => {
        const weight = parseFloat(s.weight) || 0;
        const price = parseFloat(s.price_per_kg) || 0;
        const packs = parseInt(s.packs) || 0;
        
        // 🔧 FIXED: CustomerPackCost is already the TOTAL cost
        const packCost = parseFloat(s.CustomerPackCost) || 0;
        const itemTotal = weight * price;

        totalSales += itemTotal;
        totalPacks += packs;
        
        // 🔧 FIXED: Use packCost directly
        totalPackCost += packCost;

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

    const finalGrandTotal = totalSales + totalPackCost;

    // Limit to first 4 items for quarter page
    const displayItems = itemsList.slice(0, 4);
    const remainingCount = itemsList.length - 4;

    const itemsRows = displayItems.map(item => `
        <tr style="border-bottom: 1px solid #000;">
            <td style="padding: 3px 2px; text-align: center; font-size: 7px; font-weight: bold; color: #000; border: 0.5px solid #000;">${item.id}</td>
            <td style="padding: 3px 2px; font-weight: bold; color: #000; border: 0.5px solid #000;">
                <span style="font-size: 8px; color: #000; font-weight: bold;">${item.name}</span><br>
                <span style="color: #000; font-size: 6px; font-weight: bold;">${item.code}</span>
            </td>
            <td style="padding: 3px 2px; text-align: right; font-size: 7px; font-weight: bold; color: #000; border: 0.5px solid #000;">${formatNumber(item.weight)}</td>
            <td style="padding: 3px 2px; text-align: right; font-size: 7px; font-weight: bold; color: #000; border: 0.5px solid #000;">${formatNumber(item.price)}</td>
            <td style="padding: 3px 2px; text-align: center; font-size: 7px; font-weight: bold; color: #000; border: 0.5px solid #000;">${item.packs}</td>
            <td style="padding: 3px 2px; text-align: right; font-size: 7px; font-weight: bold; color: #000; border: 0.5px solid #000;">${formatNumber(item.total)}</td>
        </tr>
    `).join('');

    // Rest of the A4 template remains the same...
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
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
        }
        body { 
            font-family: 'Courier New', 'Segoe UI', monospace; 
            background: #fff; 
            padding: 0;
            margin: 0;
        }
        @media print { 
            body { 
                padding: 0; 
                margin: 0;
            } 
            @page { 
                size: 105mm 74mm; 
                margin: 1mm; 
            } 
            .no-print { 
                display: none; 
            }
        }
        .receipt { 
            width: 100%;
            max-width: 105mm;
            margin: 0 auto; 
            background: white;
            padding: 2mm;
        }
        /* ALL TEXT IS BLACK AND BOLD */
        div, span, p, td, th, strong, b, .shop-name, .address, .contact, .bill-number-section,
        .customer-label-small, .customer-name-large, .mobile-text, .total-line, .grand-total,
        .summary-title, .summary-item, .footer p {
            color: #000000 !important;
            font-weight: bold !important;
        }
        .top-header {
            position: relative;
            text-align: center;
            margin-bottom: 4px;
            padding-bottom: 4px;
            border-bottom: 1.5px solid #000;
        }
        .f2-badge {
            position: absolute;
            left: 0;
            top: 0;
            font-size: 9px;
            font-weight: bold;
            font-family: monospace;
            background: #000;
            color: white !important;
            padding: 2px 5px;
            letter-spacing: 1px;
            border: 1px solid #000;
        }
        .shop-name { 
            font-size: 11px; 
            font-weight: bold; 
            color: #000; 
            margin-bottom: 2px; 
            letter-spacing: 0.5px;
            display: inline-block;
        }
        .address { 
            font-size: 6px; 
            font-weight: bold;
            color: #000; 
            margin-bottom: 1px; 
            text-align: center;
        }
        .contact { 
            font-size: 5.5px; 
            font-weight: bold;
            color: #000; 
            margin-bottom: 3px; 
            text-align: center;
        }
        .info-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin: 4px 0 5px 0;
            padding: 3px 4px;
            background: #fff;
            border: 1px solid #000;
        }
        .bill-number-section {
            font-size: 6px;
            font-weight: bold;
            color: #000;
        }
        .bill-number-section strong {
            color: #000;
            font-size: 7px;
            font-weight: bold;
        }
        .customer-info-section {
            text-align: right;
        }
        .customer-label-small {
            font-size: 5px;
            color: #000;
            font-weight: bold;
            margin-bottom: 1px;
        }
        .customer-name-box {
            background: #000;
            color: white !important;
            padding: 2px 6px;
            display: inline-block;
            margin: 1px 0;
        }
        .customer-name-large {
            font-size: 8px;
            font-weight: bold;
            color: white !important;
            letter-spacing: 0.5px;
        }
        .mobile-text {
            font-size: 5px;
            font-weight: bold;
            color: #000;
            margin-top: 1px;
        }
        .items-table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-bottom: 5px; 
            font-size: 6px; 
        }
        .items-table th { 
            background: #000 !important;
            color: white !important;
            padding: 3px 2px; 
            text-align: center; 
            font-weight: bold; 
            font-size: 6px;
            border: 0.5px solid #000;
        }
        .items-table td { 
            padding: 3px 2px; 
            border: 0.5px solid #000; 
        }
        .totals-box { 
            background: #fff; 
            padding: 4px; 
            margin-bottom: 5px; 
            border: 1px solid #000; 
        }
        .total-line { 
            display: flex; 
            justify-content: space-between; 
            padding: 2px 0; 
            font-size: 7px; 
            font-weight: bold;
            color: #000;
        }
        .grand-total { 
            border-top: 2px double #000; 
            margin-top: 4px; 
            padding-top: 4px; 
            font-size: 9px; 
            font-weight: bold; 
            color: #000; 
        }
        .summary-box { 
            background: #fff; 
            padding: 4px; 
            margin-bottom: 4px; 
            border: 1px solid #000; 
        }
        .summary-title { 
            font-weight: bold; 
            margin-bottom: 3px; 
            font-size: 7px; 
            text-align: center; 
            color: #000;
        }
        .summary-grid { 
            display: flex; 
            flex-wrap: wrap; 
            gap: 3px; 
            justify-content: center; 
        }
        .summary-item { 
            background: #fff; 
            padding: 2px 4px; 
            border: 0.5px solid #000; 
            font-size: 5.5px; 
            font-weight: bold;
            color: #000;
        }
        .footer { 
            text-align: center; 
            margin-top: 4px; 
            padding-top: 3px; 
            border-top: 1px solid #000; 
            font-size: 5px; 
            font-weight: bold;
            color: #000; 
        }
        .footer p:first-child {
            color: #000;
            font-size: 6px;
            margin-bottom: 2px;
        }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .font-bold { font-weight: bold; }
    </style>
</head>
<body>
    <div class="receipt">
        <div class="top-header">
            <div class="f2-badge">F2-1</div>
            <div class="shop-name">මහතුන් වෙළඳසැල</div>
        </div>
        
        <div class="address">එළවළු හා පලතුරු කොමිස් පීටි</div>
        <div class="address">විශේෂ ආර්ථික මධ්‍යස්ථානය දඹුල්ල</div>
        <div class="contact">දු: 0777672838 / 0714371115</div>
        
        <div class="info-row">
            <div class="bill-number-section">
                බිල් අංකය: <strong>${billNo}</strong>
            </div>
            <div class="customer-info-section">
                <div class="customer-label-small">ගනුදෙනුකරු</div>
                <div class="customer-name-box">
                    <div class="customer-name-large">${customerName.toUpperCase()}</div>
                </div>
                <div class="mobile-text">දු: ${mobile}</div>
            </div>
        </div>
        
        <table class="items-table">
            <thead>
                <tr>
                    <th style="width: 8%">#</th>
                    <th style="width: 32%">අයිතමය</th>
                    <th style="width: 15%">බර(kg)</th>
                    <th style="width: 15%">මිල</th>
                    <th style="width: 12%">මලු</th>
                    <th style="width: 18%">එකතුව</th>
                </tr>
            </thead>
            <tbody>${itemsRows}</tbody>
        </table>
        ${remainingCount > 0 ? `<div style="text-align: center; font-size: 6px; font-weight: bold; color: #000; margin-bottom: 4px; border: 0.5px solid #000; padding: 2px;">+ ${remainingCount} තවත් අයිතම</div>` : ''}
        
        <div class="totals-box">
            <div class="total-line">
                <span>භාණ්ඩ එකතුව:</span>
                <span>රු. ${formatNumber(totalSales)}</span>
            </div>
            <div class="total-line">
                <span>මලු ගාස්තු (${totalPacks}):</span>
                <span>රු. ${formatNumber(totalPackCost)}</span>
            </div>
            ${globalLoanAmount !== 0 ? `
            <div class="total-line">
                <span>පෙර ණය:</span>
                <span>රු. ${formatNumber(Math.abs(globalLoanAmount))}</span>
            </div>
            ` : ''}
            <div class="grand-total">
                <span>මුළු එකතුව:</span>
                <span>රු. ${formatNumber(finalGrandTotal)}</span>
            </div>
        </div>
        
        <div class="footer">
            <p>*** ස්තුතියි! නැවත පැමිණෙන්න ***</p>
            <p>${date} | ${time}</p>
        </div>
    </div>
</body>
</html>`;
};