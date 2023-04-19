import express from 'express';
import {v4 as uuid} from 'uuid';
import cors from 'cors';
import {create} from 'express-handlebars';
import fileUpload from 'express-fileupload';
import fs from 'fs';
import moment from 'moment';
moment().format();

import * as path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

app.listen(3000, () => console.log("http://localhost:3000"));

//MIDDLEWARE
app.use(express.json());
app.use(express.urlencoded({extended: false}))
app.use(fileUpload({
    limits: { fileSize: 5 * 1024 * 1024 },
    abortOnLimit: true,
    responseOnLimit: "La imágen que está subiendo sobrepasa los 5mb permitidos."
}));

  app.use(cors());
  app.use('/public', express.static('public'))

//configuracion de handlebars

const hbs = create({
	partialsDir: [
		"views/partials/",
	],
});

app.engine("handlebars", hbs.engine);
app.set("view engine", "handlebars");
app.set("views", path.resolve(__dirname, "./views"));

//FUNCIONES
const leerProductos = () => {
    return new Promise((resolve, reject) => {
        fs.readFile("productos.json", "utf8", (error, data) => {
            if(error) return reject("Ha ocurrido un error al cargar los productos.");
            let productos = JSON.parse(data)
            resolve(productos)
        })
    })
}

const leerProductosPorId = (id) => {
    return new Promise((resolve, reject) => {
        fs.readFile("productos.json", "utf8", (error, data) => {
            if(error) return reject("Ha ocurrido un error al cargar los productos.");
            let productos = JSON.parse(data)
            let found = productos.productos.find(producto => producto.id == id);
            if(found){
                resolve(found)
            }else{
                reject("Producto no encontrado.")
            }
        })
    })
}

const actualizarProductos = (productos) => {
    return new Promise((resolve, reject) => {
        fs.writeFile("productos.json", JSON.stringify(productos, null, 4), (error) => {
            if(error) return reject("Error al actualizar productos.")
            return resolve("productos actualizados correctamente.")
        })
    })
}

function descontarProductos(productosADescontar){
    return new Promise((resolve, reject) => {
        leerArchivo("productos.json").then(data => {
            productosADescontar.productos.forEach(producto => {
                let productoDescontado = data.productos.find(element => element.id == producto.id)
                productoDescontado.stock = productoDescontado.stock - producto.cantidad;
            });
            actualizarArchivo("productos.json", data).then(respuesta => {
                resolve(respuesta)
            }).catch(error => {
                reject(error)
            })
        }).catch(error => {
            reject(error)
        })
    })
}

function leerArchivo(nombre) {
    return new Promise((resolve, reject) => {
        fs.readFile(nombre, "utf8", (error, data )=> {
            if(error) reject("Error al leer los datos.")
            data = JSON.parse(data);
            resolve(data);
        })
    })
}


//RUTAS

//RUTA PRINCIPAL HOME
app.get("/", (req, res) => {
    leerProductos().then(productos=> {
        res.render("home", {
            productos: productos.productos
        });
    }).catch(error => {
        res.render("home", {
            error
        });
    })
})

app.get("/inventario", (req, res) => {
    leerProductos().then(productos=> {
        res.render("inventario", {
            productos: productos.productos
        });
    }).catch(error => {
        res.render("inventario", {
            error
        });
    })
})

app.get("/update/productos/:id", (req, res) => {
    let { id } = req.params;
    leerProductosPorId(id).then(producto => {
        res.render("updateProducto", {
            producto
        })

    }).catch(error => {
        res.render("updateProducto", {
            error
        })
    })
})

app.put("/productos/:id", async (req, res) => {
    try {
        let {id} = req.params;
    let { nombre, descripcion, stock, precio } = req.body;
    
    let productoModificado = {
        id, nombre, descripcion, stock, precio
    };

    let productos = await leerProductos();

    //buscamos indice del producto que vamos a moficiar
    let index = productos.productos.findIndex(producto => producto.id == id)
    //le asignamos en primera instancia el nombre de la imágen antigua
        productoModificado.imagen = productos.productos[index].imagen
        //reemplazamos objeto antiguo por el nuevo.
        productos.productos[index] = productoModificado;

        //si lllega una foto
        if(req.files){
            let foto = req.files.foto; 
            //creamos un nombre único para cada imagen usando uuid
            let nombreImagen = `${uuid().slice(0,6)}-${foto.name}`;
            //eliminamos foto antigua
            let rutaFotoAntigua = __dirname + '/public/imgs/' + productos.productos[index].imagen;
            //validamos si existe imagen antigua
           fs.readFile(rutaFotoAntigua, "utf8", (error, data) => {
                if(data){
                    //si efectivamente existia la foto antigua, la elimnamos.
                    fs.unlinkSync(rutaFotoAntigua)
                }


                //le asignamos el nombre muevo al producto 
                productos.productos[index].imagen = nombreImagen;
                //creamos ruta para guardar imágenes.
                let rutaImagen = __dirname + '/public/imgs/' + nombreImagen;
                //guardamos imagen en carpeta usando función mv.

                foto.mv(rutaImagen, async (error) => {
                    if(error){
                        return res.status(500).json({code: 500, message: "error al guardar la imagen"})
                    }else{
                        console.log("actualizar producto con foto")
                        await actualizarProductos(productos)
                        return res.json({code: 200, message: "Producto actualizado correctamente."})
                    }
                })
           })

        }else{
            console.log("actualizar producto sin foto")
            await actualizarProductos(productos)
            return res.json({code: 200, message:"Producto actualizado correctamente."})
        }
        
    } catch (error) {
        console.log(error)
        res.status(500).json({code: 500, message: "Error al actualizar el producto"})
    }
    

})



