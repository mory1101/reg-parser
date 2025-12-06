import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import regulationRoutes from './routes/regulationRoutes.js';

const app = express();
const PORT = 5000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log(__filename);

app.use(express.static(path.join(__dirname, "public")));
app.use('/api',regulationRoutes);

app.get('/healthz' , (req,res)=>{
    res.json({status: 'OK', message: 'Regulation Parser Server running'})
});


app.listen(PORT , ()=> console.log(`Server running on http://localhost' , ${PORT}`));
