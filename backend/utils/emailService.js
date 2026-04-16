const nodemailer = require('nodemailer');
const ExcelJS = require('exceljs');
const { decrypt } = require('./encryption');

/**
 * Genera un archivo Excel y lo envía por correo electrónico al administrador
 * @param {Object} orderData Datos del pedido
 */
async function sendOrderEmail(orderData) {
    try {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Pedido');

        // Styles
        const titleStyle = { font: { bold: true, size: 14 } };
        const headerStyle = { font: { bold: true }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } } };

        // 1. Datos del Solicitante
        sheet.addRow(['DATOS DEL SOLICITANTE']).font = titleStyle;
        sheet.addRow(['Nombre', 'Apellido', 'Correo', 'Teléfono']);
        const reqInfo = orderData.requesterInfo || {};
        sheet.addRow([
            reqInfo.nombre || 'N/A',
            reqInfo.apellido || 'N/A',
            reqInfo.email || 'N/A',
            reqInfo.telefono || 'N/A'
        ]);
        sheet.addRow([]);

        // 2. Datos del Grupo
        if (orderData.type === 'GROUP_ORDER') {
            sheet.addRow(['DATOS DEL GRUPO']).font = titleStyle;
            sheet.addRow(['Colegio', 'Curso', 'Región', 'Ciudad']);
            const g = orderData.groupInfo || {};
            sheet.addRow([
                g.colegio || 'N/A',
                g.curso || 'N/A',
                g.region || 'N/A',
                g.ciudad || 'N/A'
            ]);
            sheet.addRow([]);
        }

        // 3. Detalle de Estudiantes
        sheet.addRow(['DETALLE DEL PEDIDO']).font = titleStyle;
        sheet.addRow(['Producto', orderData.producto || 'Polerón']);
        sheet.addRow(['Fecha', new Date(orderData.date).toLocaleString()]);
        sheet.addRow([]);
        sheet.addRow(['#', 'Nombre', 'Apellido', 'Apodo', 'Talla']).font = headerStyle;
        
        const list = orderData.estudiantes || [];
        list.forEach((s, i) => {
            sheet.addRow([i + 1, s.nombre || '', s.apellido || '', s.apodo || '', s.talla || '']);
        });

        const buffer = await workbook.xlsx.writeBuffer();

        // CONFIGURACIÓN DE NODEMAILER
        const user = process.env.SMTP_USER || 'inzunzajuan202@gmail.com';
        const pass = process.env.SMTP_PASS;

        if (!pass) {
            throw new Error('Configuración incompleta: SMTP_PASS no detectada');
        }

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: user,
                pass: pass
            }
        });

        const adminEmail = process.env.ADMIN_EMAIL || 'inzunzajuan202@gmail.com';
        const requesterName = reqInfo.nombre ? `${reqInfo.nombre} ${reqInfo.apellido}` : 'Un cliente';

        const mailOptions = {
            from: `"App Poleron" <${user}>`,
            to: adminEmail,
            subject: `Pedido Poleron - ${requesterName} - ${orderData.groupInfo?.colegio || 'Personal'}`,
            text: `Nuevo pedido de ${requesterName}.\nColegio: ${orderData.groupInfo?.colegio || 'N/A'}\n\nSe adjunta el Excel detallado.`,
            attachments: [
                {
                    filename: `Pedido_${Date.now()}.xlsx`,
                    content: buffer
                }
            ]
        };

        // Adjuntar diseños
        if (orderData.disenos) {
            orderData.disenos.forEach((file, index) => {
                if (file.base64) {
                    mailOptions.attachments.push({
                        filename: file.name || `diseno_${index + 1}.png`,
                        content: file.base64,
                        encoding: 'base64'
                    });
                }
            });
        }

        await transporter.sendMail(mailOptions);
        console.log('✅ Email enviado satisfactoriamente.');
        return true;
        
    } catch (error) {
        console.error('❌ Error en sendOrderEmail:', error.message);
        throw error;
    }
}

module.exports = { sendOrderEmail };
