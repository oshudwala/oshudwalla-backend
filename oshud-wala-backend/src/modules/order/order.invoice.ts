import { Response } from 'express';
import PDFDocument from 'pdfkit';

export const generateInvoicePdf = (order: any, res: Response) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Invoice-${order.orderNumber}.pdf"`);

    doc.pipe(res);

    // --- Header ---
    doc.fillColor('#064e3b').fontSize(22).font('Helvetica-Bold').text('OSHUD WALA', 40, 40);
    doc.fillColor('#047857').fontSize(10).font('Helvetica-Bold').text('HEALTHCARE COMMERCE & PHARMACY NETWORK', 40, 65);
    doc.fillColor('#6b7280').fontSize(9).font('Helvetica').text('Government Licensed Retail & Prescription Delivery', 40, 78);

    doc.fillColor('#111827').fontSize(16).font('Helvetica-Bold').text('TAX INVOICE / RETAIL BILL', 340, 40, { align: 'right' });
    doc.fillColor('#374151').fontSize(10).font('Helvetica-Bold').text(`Order #: ${order.orderNumber}`, 340, 62, { align: 'right' });
    doc.fillColor('#6b7280').fontSize(9).font('Helvetica').text(`Date: ${new Date(order.placedAt || order.createdAt).toLocaleString('en-IN')}`, 340, 76, { align: 'right' });
    doc.fillColor('#065f46').fontSize(9).font('Helvetica-Bold').text(`Payment: ${order.paymentMethod || 'COD'} (${order.paymentStatus || 'PAID'})`, 340, 90, { align: 'right' });

    doc.moveTo(40, 110).lineTo(555, 110).strokeColor('#e5e7eb').lineWidth(1).stroke();

    // --- Bill To & Dispensed By Boxes ---
    const topBoxY = 120;
    // Dispensed By (Pharmacy)
    doc.fillColor('#065f46').fontSize(11).font('Helvetica-Bold').text('DISPENSED BY (PHARMACY):', 40, topBoxY);
    doc.fillColor('#111827').fontSize(10).font('Helvetica-Bold').text(order.pharmacy?.name || 'Primary Pharmacy Hub', 40, topBoxY + 16);
    doc.fillColor('#4b5563').fontSize(9).font('Helvetica')
        .text(order.pharmacy?.line1 ? `${order.pharmacy.line1}, ${order.pharmacy.city || 'Kolkata'}` : 'Authorized Medicine Fulfillment Centre', 40, topBoxY + 30)
        .text(`Drug License: ${order.pharmacy?.licenseNumber || 'WB-DL-2024-9901'}`, 40, topBoxY + 42)
        .text(`Contact: ${order.pharmacy?.phone || '+91 98000 00000'}`, 40, topBoxY + 54);

    // Bill To (Patient)
    const deliv = order.deliveryAddress || {};
    const patientName = deliv.fullName || order.patient?.fullName || 'Walk-in / App Patient';
    const patientPhone = deliv.phone || order.patient?.phone || '9876543210';
    const patientAddress = deliv.line1 || deliv.address || 'Direct Patient Handover';
    const areaPincode = `${deliv.area ? deliv.area + ', ' : ''}${deliv.city || 'Kolkata'} ${deliv.pincode ? '- ' + deliv.pincode : ''}`;

    doc.fillColor('#065f46').fontSize(11).font('Helvetica-Bold').text('PATIENT / BILL TO:', 320, topBoxY);
    doc.fillColor('#111827').fontSize(10).font('Helvetica-Bold').text(patientName, 320, topBoxY + 16);
    doc.fillColor('#4b5563').fontSize(9).font('Helvetica')
        .text(`Phone: ${patientPhone}`, 320, topBoxY + 30)
        .text(patientAddress, 320, topBoxY + 42, { width: 230 })
        .text(areaPincode, 320, topBoxY + 56);

    doc.moveTo(40, 195).lineTo(555, 195).strokeColor('#e5e7eb').lineWidth(1).stroke();

    // --- Items Table Header ---
    const tableHeaderY = 205;
    doc.rect(40, tableHeaderY, 515, 22).fill('#f0fdf4');
    doc.fillColor('#065f46').fontSize(9).font('Helvetica-Bold')
        .text('SL', 50, tableHeaderY + 6)
        .text('MEDICINE ITEM / FORMULATION', 80, tableHeaderY + 6)
        .text('QTY', 340, tableHeaderY + 6, { width: 40, align: 'center' })
        .text('UNIT MRP (₹)', 390, tableHeaderY + 6, { width: 70, align: 'right' })
        .text('TOTAL (₹)', 470, tableHeaderY + 6, { width: 75, align: 'right' });

    let currentY = tableHeaderY + 26;
    const items = order.items || [];

    if (items.length === 0) {
        doc.fillColor('#6b7280').fontSize(9).font('Helvetica')
            .text('Prescription Medicines Package', 80, currentY)
            .text('1', 340, currentY, { width: 40, align: 'center' })
            .text(`₹${(order.subtotalPaise / 100).toFixed(2)}`, 390, currentY, { width: 70, align: 'right' })
            .text(`₹${(order.subtotalPaise / 100).toFixed(2)}`, 470, currentY, { width: 75, align: 'right' });
        currentY += 20;
    } else {
        items.forEach((it: any, idx: number) => {
            const name = it.nameSnapshot || it.product?.name || `Item #${idx + 1}`;
            const qty = it.quantity || 1;
            const unitPrice = it.unitPricePaise ? (it.unitPricePaise / 100).toFixed(2) : (it.mrpPaise ? (it.mrpPaise / 100).toFixed(2) : '0.00');
            const lineTotal = it.lineTotalPaise ? (it.lineTotalPaise / 100).toFixed(2) : (Number(unitPrice) * qty).toFixed(2);

            doc.fillColor('#4b5563').fontSize(9).font('Helvetica').text(String(idx + 1), 50, currentY);
            doc.fillColor('#111827').font('Helvetica-Bold').text(name, 80, currentY, { width: 250 });
            doc.fillColor('#4b5563').font('Helvetica')
                .text(String(qty), 340, currentY, { width: 40, align: 'center' })
                .text(`₹${unitPrice}`, 390, currentY, { width: 70, align: 'right' })
                .text(`₹${lineTotal}`, 470, currentY, { width: 75, align: 'right' });

            currentY += 18;
            if (currentY > 700) {
                doc.addPage();
                currentY = 40;
            }
        });
    }

    doc.moveTo(40, currentY + 5).lineTo(555, currentY + 5).strokeColor('#e5e7eb').lineWidth(1).stroke();
    currentY += 15;

    // --- Summary & Calculation Section ---
    const summaryX = 330;
    const subtotalRs = (order.subtotalPaise / 100).toFixed(2);
    const discountRs = (order.couponDiscountPaise / 100).toFixed(2);
    const deliveryRs = order.deliveryFeePaise === 0 ? 'FREE' : `₹${(order.deliveryFeePaise / 100).toFixed(2)}`;
    const packagingRs = '₹6.00';
    const totalRs = (order.totalPaise / 100).toFixed(2);

    doc.fillColor('#374151').fontSize(9).font('Helvetica')
        .text('Medicines Subtotal:', summaryX, currentY)
        .text(`₹${subtotalRs}`, 470, currentY, { width: 75, align: 'right' });
    currentY += 15;

    if (order.couponDiscountPaise > 0) {
        doc.fillColor('#059669').font('Helvetica-Bold')
            .text('Discount Applied:', summaryX, currentY)
            .text(`-₹${discountRs}`, 470, currentY, { width: 75, align: 'right' });
        currentY += 15;
    }

    doc.fillColor('#374151').font('Helvetica')
        .text('Packaging Fee (Fixed):', summaryX, currentY)
        .text(packagingRs, 470, currentY, { width: 75, align: 'right' });
    currentY += 15;

    const subtotalNum = Number(subtotalRs) || 0;
    const platformFeeRs =
        subtotalNum <= 0 ? 0 :
        subtotalNum < 999 ? 9 :
        subtotalNum < 1999 ? 12 :
        subtotalNum < 2999 ? 15 :
        subtotalNum < 3999 ? 20 :
        subtotalNum < 5000 ? 25 : 30;

    doc.fillColor('#374151').font('Helvetica')
        .text('Platform Fee (Tiered):', summaryX, currentY)
        .text(`₹${platformFeeRs.toFixed(2)}`, 470, currentY, { width: 75, align: 'right' });
    currentY += 15;

    doc.fillColor('#374151').font('Helvetica')
        .text('Delivery Charges:', summaryX, currentY)
        .text(deliveryRs, 470, currentY, { width: 75, align: 'right' });
    currentY += 18;

    doc.rect(summaryX - 10, currentY - 4, 235, 24).fill('#064e3b');
    doc.fillColor('#ffffff').fontSize(11).font('Helvetica-Bold')
        .text('NET AMOUNT PAYABLE:', summaryX, currentY + 3)
        .text(`₹${totalRs}`, 450, currentY + 3, { width: 95, align: 'right' });

    currentY += 40;

    // --- Delivery Fee Policy Note ---
    doc.rect(40, currentY, 515, 30).fill('#f8fafc');
    doc.fillColor('#065f46').fontSize(8).font('Helvetica-Bold')
        .text('DELIVERY CHARGE POLICY:', 50, currentY + 6);
    doc.fillColor('#475569').fontSize(8).font('Helvetica')
        .text('Orders with subtotal under ₹499 carry a nominal delivery charge of ₹30. Orders of ₹499 and above receive FREE doorstep delivery.', 50, currentY + 17);

    // --- Footer Notice ---
    doc.fillColor('#9ca3af').fontSize(8).font('Helvetica')
        .text('This is a computer-generated tax invoice. Verified by registered licensed pharmacist under the Drugs and Cosmetics Act.', 40, 770, { align: 'center', width: 515 })
        .text('Oshud Wala Healthcare Network • Fast, Safe, Licensed Medicine Delivery', 40, 782, { align: 'center', width: 515 });

    doc.end();
};
