// controllers/user.controller.js
const jwt = require('jsonwebtoken');
const UserModel = require('../models/userModel');
const conexion = require('../helpers/conexion');

class UserController {
    static async create(req, res) {
        try {
            // Validar campos requeridos
            const requiredFields = ['first_name', 'last_name', 'email', 'password', 'birth_date', 'document_number', 'city'];
            for (const field of requiredFields) {
                if (!req.body[field]) {
                    return res.status(400).json({ message: `El campo ${field} es requerido` });
                }
            }

            // Validar formato de fecha
            if (!Date.parse(req.body.birth_date)) {
                return res.status(400).json({ message: 'Formato de fecha inválido. Use YYYY-MM-DD' });
            }

            // Crear usuario con todas sus relaciones
            console.log(res.body);
            
            const user = await UserModel.createWithRelations(req.body);


            // Generar token
            const token = jwt.sign(
                { 
                    id: user.id, 
                    email: user.email, 
                    role: 'camper' 
                },
                process.env.JWT_SECRET,
                { expiresIn: '24h' }
            );

            res.status(201).json({ token, user });
        } catch (error) {
            console.error('Error en create:', error);
            res.status(400).json({ 
                message: 'Error al crear el usuario',
                error: error.message 
            });
        }
    }

    static async login(req, res) {
        try {
            const { email, password } = req.body;
            
            // Buscar usuario por email
            const user = await UserModel.findByEmail(email);
            
            if (!user) {
                return res.status(401).json({ message: 'Credenciales inválidas' });
            }

            // Validar contraseña
            const isValidPassword = await UserModel.validatePassword(user, password);
            if (!isValidPassword) {
                return res.status(401).json({ message: 'Credenciales inválidas' });
            }

            // Generar token
            const token = jwt.sign(
                { 
                    id: user.id, 
                    email: user.email, 
                    role: user.role 
                },
                process.env.JWT_SECRET,
                { expiresIn: '24h' }
            );

            // Eliminar la contraseña del objeto usuario antes de enviarlo
            delete user.password;

            res.json({ 
                token,
                user
            });
        } catch (error) {
            console.error('Error en login:', error);
            res.status(500).json({ message: 'Error en el servidor' });
        }
    }

    static async logout(req, res) {
        res.json({ message: 'Sesión cerrada exitosamente' });
    }

    static async getAll(req, res) {
        try {
            const users = await UserModel.findAll();
            res.json(users);
        } catch (error) {
            console.error('Error en getAll:', error);
            res.status(500).json({ message: 'Error al obtener usuarios' });
        }
    }

    static async getById(req, res) {
        try {
            const user = await UserModel.findById(req.params.id);
            if (!user) {
                return res.status(404).json({ message: 'Usuario no encontrado' });
            }
            res.json(user);
        } catch (error) {
            console.error('Error en getById:', error);
            res.status(500).json({ message: 'Error al obtener el usuario' });
        }
    }

    static async update(req, res) {
        try {
            // Implementar actualización si es necesario
            res.status(501).json({ message: 'Función no implementada' });
        } catch (error) {
            console.error('Error en update:', error);
            res.status(400).json({ message: 'Error al actualizar el usuario' });
        }
    }

    static async delete(req, res) {
        try {
            const query = 'DELETE FROM USER WHERE id = ?';
            await conexion.query(query, [req.params.id]);
            res.json({ message: 'Usuario eliminado exitosamente' });
        } catch (error) {
            console.error('Error en delete:', error);
            res.status(500).json({ message: 'Error al eliminar el usuario' });
        }
    }
}

module.exports = UserController;