import PDFDocument from 'pdfkit';
import { Response } from 'express';
import { prisma } from '../../config/prisma';
import { ApiError } from '../../utils/apiError';

export const streamOrderInvoicePdf = async (orderId: string, requesterId: string, requesterRole: string, res: Response) => {
    const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
            patient: { select: { fullName: true, phone: true, email: true } },
            pharmacy: { select: { name: true, phone: true, line1: true, city: true, pincode: true } },
            items: true,
        },
    });
    if (!order) throw new ApiError(404, 'Order not found');
    if (requesterRole === 'PATIENT' && order.patientId !== requesterId) {
        throw new ApiError(403, 'You can only download your own invoice');
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${order.orderNumber}.pdf"`);

    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(res);

    doc.fontSize(20).text('OSHUD WALA - TAX INVOICE / BILL', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).text(`Order No: ${order.orderNumber}   |   Date: ${order.placedAt.toISOString().slice(0, 10)}`, { align: 'center' });
    doc.moveDown();

    doc.fontSize(12).text(`Pharmacy: ${order.pharmacy.name}`);
    doc.fontSize(10).text(`${order.pharmacy.line1}, ${order.pharmacy.city} - ${order.pharmacy.pincode} | Ph: ${order.pharmacy.phone}`);
    doc.moveDown(0.5);

    doc.fontSize(12).text(`Patient: ${order.patient.fullName}`);
    doc.fontSize(10).text(`Phone: ${order.patient.phone}${order.patient.email ? ` | Email: ${order.patient.email}` : ''}`);
    doc.moveDown();

    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.5);

    if (order.items.length > 0) {
        doc.fontSize(11).text('Items:', { underline: true });
        for (const item of order.items) {
            doc.fontSize(10).text(`- ${item.nameSnapshot} x ${item.quantity}  |  MRP: Rs.${(item.mrpPaise / 100).toFixed(2)}`);
        }
    } else {
        doc.fontSize(11).text('Prescription Medicines (Billed by Pharmacy)');
    }

    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.5);

    const totalDiscount = (order.couponDiscountPaise || 0) + (order.coinDiscountPaise || 0);
    doc.fontSize(11).text(`Total MRP: Rs.${(order.subtotalPaise / 100).toFixed(2)}`);
    doc.fontSize(11).text(`Discount / Savings: - Rs.${(totalDiscount / 100).toFixed(2)}`);
    doc.fontSize(14).text(`Final Payable Amount (COD): Rs.${(order.totalPaise / 100).toFixed(2)}`, { underline: true });
    doc.moveDown();
    doc.fontSize(9).text('Thank you for choosing Oshud Wala!', { align: 'center' });

    doc.end();
};
