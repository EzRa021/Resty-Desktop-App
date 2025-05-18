import React, { useState, useEffect } from 'react';
import { getSocket } from '../lib/socket';
import {
  Box,
  Paper,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid,
  Switch,
  FormControlLabel,
  TextField,
  Button,
  CircularProgress
} from '@mui/material';
import JsBarcode from 'jsbarcode';

// const PAPER_SIZES = {
//   '80mm': { width: '80mm', maxWidth: '80mm' },
//   '58mm': { width: '58mm', maxWidth: '58mm' },
//   'A4': { width: '210mm', maxWidth: '210mm' }
// };

// const ReceiptPreview = ({ orderId, onClose }) => {
//   const [loading, setLoading] = useState(true);
//   const [receipt, setReceipt] = useState(null);
//   const [settings, setSettings] = useState({
//     paperSize: '80mm',
//     showLogo: true,
//     showAddress: true,
//     showPhone: true,
//     showTax: true,
//     showDate: true,
//     showTime: true,
//     showOrderNumber: true,
//     showCashier: true,
//     showTable: true,
//     showCustomer: true,
//     showNotes: true,
//     showFooter: true,
//     showBarcode: true,
//     showQRCode: true,
//     headerText: '',
//     footerText: 'Thank you for your business!',
//     logoPosition: 'center',
//     fontSize: 'normal',
//     lineSpacing: 'normal'
//   });

//   useEffect(() => {
//     const socket = getSocket();
    
//     const generatePreview = async () => {
//       try {
//         setLoading(true);
//         socket.emit('pos:generateReceiptPreview', {
//           orderId,
//           previewSettings: settings
//         }, (response) => {
//           if (response.success) {
//             setReceipt(response.data);
//           } else {
//             console.error('Failed to generate preview:', response.message);
//           }
//           setLoading(false);
//         });
//       } catch (error) {
//         console.error('Error generating preview:', error);
//         setLoading(false);
//       }
//     };

//     generatePreview();

//     return () => {
//       socket.off('pos:generateReceiptPreview');
//     };
//   }, [orderId, settings]);

//   const handleSettingChange = (setting, value) => {
//     setSettings(prev => ({
//       ...prev,
//       [setting]: value
//     }));
//   };

//   const handlePrint = () => {
//     const printWindow = window.open('', '_blank');
//     printWindow.document.write(`
//       <html>
//         <head>
//           <title>Receipt</title>
//           <style>
//             body {
//               font-family: monospace;
//               width: ${PAPER_SIZES[settings.paperSize].width};
//               margin: 0 auto;
//               padding: 10px;
//             }
//             .receipt-content {
//               white-space: pre-wrap;
//               font-size: ${settings.fontSize === 'small' ? '12px' : settings.fontSize === 'large' ? '16px' : '14px'};
//               line-height: ${settings.lineSpacing === 'compact' ? '1.2' : settings.lineSpacing === 'wide' ? '1.8' : '1.5'};
//             }
//             .receipt-image {
//               display: block;
//               margin: 10px auto;
//               max-width: 100%;
//             }
//             @media print {
//               body {
//                 width: ${PAPER_SIZES[settings.paperSize].width};
//               }
//             }
//           </style>
//         </head>
//         <body>
//           <div class="receipt-content">
//             ${receipt.text}
//           </div>
//           ${receipt.images.map(image => `
//             <img 
//               class="receipt-image" 
//               src="${image.data}" 
//               alt="${image.type}"
//               style="text-align: ${image.position};"
//             />
//           `).join('')}
//         </body>
//       </html>
//     `);
//     printWindow.document.close();
//     printWindow.print();
//   };

//   if (loading) {
//     return (
//       <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
//         <CircularProgress />
//       </Box>
//     );
//   }

//   return (
//     <Box p={3}>
//       <Grid container spacing={3}>
//         <Grid item xs={12} md={8}>
//           <Paper 
//             elevation={3} 
//             sx={{ 
//               p: 2,
//               width: PAPER_SIZES[settings.paperSize].width,
//               maxWidth: PAPER_SIZES[settings.paperSize].maxWidth,
//               margin: '0 auto',
//               backgroundColor: '#fff',
//               fontFamily: 'monospace',
//               fontSize: settings.fontSize === 'small' ? '12px' : settings.fontSize === 'large' ? '16px' : '14px',
//               lineHeight: settings.lineSpacing === 'compact' ? '1.2' : settings.lineSpacing === 'wide' ? '1.8' : '1.5'
//             }}
//           >
//             {receipt.images.map((image, index) => (
//               <Box 
//                 key={index} 
//                 display="flex" 
//                 justifyContent={image.position === 'left' ? 'flex-start' : image.position === 'right' ? 'flex-end' : 'center'}
//                 mb={2}
//               >
//                 <img 
//                   src={image.data} 
//                   alt={image.type}
//                   style={{ maxWidth: '100%' }}
//                 />
//               </Box>
//             ))}
//             <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{receipt.text}</pre>
//           </Paper>
//         </Grid>
//         <Grid item xs={12} md={4}>
//           <Paper elevation={3} sx={{ p: 2 }}>
//             <Typography variant="h6" gutterBottom>
//               Receipt Settings
//             </Typography>
//             <FormControl fullWidth margin="normal">
//               <InputLabel>Paper Size</InputLabel>
//               <Select
//                 value={settings.paperSize}
//                 onChange={(e) => handleSettingChange('paperSize', e.target.value)}
//               >
//                 <MenuItem value="80mm">80mm Thermal</MenuItem>
//                 <MenuItem value="58mm">58mm Thermal</MenuItem>
//                 <MenuItem value="A4">A4</MenuItem>
//               </Select>
//             </FormControl>
//             <FormControl fullWidth margin="normal">
//               <InputLabel>Font Size</InputLabel>
//               <Select
//                 value={settings.fontSize}
//                 onChange={(e) => handleSettingChange('fontSize', e.target.value)}
//               >
//                 <MenuItem value="small">Small</MenuItem>
//                 <MenuItem value="normal">Normal</MenuItem>
//                 <MenuItem value="large">Large</MenuItem>
//               </Select>
//             </FormControl>
//             <FormControl fullWidth margin="normal">
//               <InputLabel>Line Spacing</InputLabel>
//               <Select
//                 value={settings.lineSpacing}
//                 onChange={(e) => handleSettingChange('lineSpacing', e.target.value)}
//               >
//                 <MenuItem value="compact">Compact</MenuItem>
//                 <MenuItem value="normal">Normal</MenuItem>
//                 <MenuItem value="wide">Wide</MenuItem>
//               </Select>
//             </FormControl>
//             <Box mt={2}>
//               <FormControlLabel
//                 control={
//                   <Switch
//                     checked={settings.showLogo}
//                     onChange={(e) => handleSettingChange('showLogo', e.target.checked)}
//                   />
//                 }
//                 label="Show Logo"
//               />
//               <FormControlLabel
//                 control={
//                   <Switch
//                     checked={settings.showBarcode}
//                     onChange={(e) => handleSettingChange('showBarcode', e.target.checked)}
//                   />
//                 }
//                 label="Show Barcode"
//               />
//               <FormControlLabel
//                 control={
//                   <Switch
//                     checked={settings.showQRCode}
//                     onChange={(e) => handleSettingChange('showQRCode', e.target.checked)}
//                   />
//                 }
//                 label="Show QR Code"
//               />
//             </Box>
//             <Box mt={2}>
//               <Button
//                 variant="contained"
//                 color="primary"
//                 fullWidth
//                 onClick={handlePrint}
//               >
//                 Print Receipt
//               </Button>
//             </Box>
//           </Paper>
//         </Grid>
//       </Grid>
//     </Box>
//   );
// };

// export default ReceiptPreview; 

// Generate barcode as SVG
const generateBarcode = (text) => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  JsBarcode(svg, text, {
    format: "CODE128",
    width: 2,
    height: 100,
    displayValue: true
  });
  return svg.outerHTML;
}; 