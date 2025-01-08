// models/userModel.js
const bcrypt = require('bcrypt');
const conexion = require('../helpers/conexion');

class UserModel {
    static async checkDocumentType(typeId = 1) {
        const query = 'SELECT id FROM DOCUMENT_TYPE WHERE id = ?';
        const result = await conexion.query(query, [typeId]);
        if (!result.data[0]) {
            throw new Error('Tipo de documento no encontrado');
        }
        return result.data[0].id;
    }

    static async createWithRelations(userData) {
        try {
            // Iniciar transacción
            await conexion.query('START TRANSACTION');

            try {
                // 1. Verificar email duplicado
                await this.checkExistingEmail(userData.email);

                // 2. Verificar que existe el tipo de documento
                await this.checkDocumentType(1);

                // 3. Obtener o crear CITY
                let cityId;
                const cityQuery = 'SELECT id FROM CITY WHERE name = ?';
                const cityResult = await conexion.query(cityQuery, [userData.city]);
                
                if (cityResult.data.length > 0) {
                    cityId = cityResult.data[0].id;
                } else {
                    const newCityQuery = 'INSERT INTO CITY (name) VALUES (?)';
                    const newCityResult = await conexion.query(newCityQuery, [userData.city]);
                    cityId = newCityResult.data.insertId;
                }

                // 4. Encriptar contraseña
                const salt = await bcrypt.genSalt(10);
                const hashedPassword = await bcrypt.hash(userData.password, salt);

                // 5. Crear usuario
                const userQuery = `
                    INSERT INTO USER (
                        first_name, last_name, email, password,
                        role, document_type_id, document_number,
                        city_id, birth_date, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
                `;

                const userParams = [
                    userData.first_name,
                    userData.last_name,
                    userData.email,
                    hashedPassword,
                    'camper',
                    1, // document_type_id por defecto
                    userData.document_number,
                    cityId,
                    userData.birth_date
                ];

                const userResult = await conexion.query(userQuery, userParams);
                const userId = userResult.data.insertId;

                // 6. Crear registro de camper
                const camperQuery = `
                INSERT INTO CAMPER (
                    user_id,
                    title,
                    description,
                    about,
                    image,
                    main_video_url,
                    full_name,
                    profile_picture,
                    status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            const camperParams = [
                userId,                                     // user_id (FK)
                'Nuevo Camper',                            // title (por defecto)
                'Bienvenido a mi perfil de Camper',        // description (por defecto)
                'Cuéntanos sobre ti...',                   // about (por defecto)
                null,                                      // image (inicialmente vacío)
                null,                                      // main_video_url (inicialmente vacío)
                `${userData.first_name} ${userData.last_name}`,  // full_name
                null,                                      // profile_picture (inicialmente vacío)
                'formacion'                                    // status inicial
                ];

                await conexion.query(camperQuery, camperParams);

                // Confirmar transacción
                await conexion.query('COMMIT');

                // 7. Retornar usuario creado
                return {
                    id: userId,
                    ...userData,
                    password: undefined,
                    role: 'camper'
                };

            } catch (error) {
                // Si algo falla, revertir cambios
                await conexion.query('ROLLBACK');
                throw error;
            }
        } catch (error) {
            console.error('Error en createWithRelations:', error);
            throw error;
        }
    }

    static async findByEmail(email) {
        try {
            const query = `
                SELECT u.*, c.name as city_name, cam.*
                FROM USER u
                LEFT JOIN CITY c ON u.city_id = c.id
                LEFT JOIN CAMPER cam ON u.id = cam.user_id
                WHERE u.email = ?
            `;
            const result = await conexion.query(query, [email]);
            return result.data[0];
        } catch (error) {
            throw error;
        }
    }

    static async findById(id) {
        try {
            const query = `
                SELECT u.*, c.name as city_name, cam.*
                FROM USER u
                LEFT JOIN CITY c ON u.city_id = c.id
                LEFT JOIN CAMPER cam ON u.id = cam.user_id
                WHERE u.id = ?
            `;
            const result = await conexion.query(query, [id]);
            if (result.data[0]) {
                delete result.data[0].password;
            }
            return result.data[0];
        } catch (error) {
            throw error;
        }
    }

    static async findAll() {
        try {
            const query = `
                SELECT u.*, c.name as city_name, cam.*
                FROM USER u
                LEFT JOIN CITY c ON u.city_id = c.id
                LEFT JOIN CAMPER cam ON u.id = cam.user_id
            `;
            const result = await conexion.query(query);
            return result.data;
        } catch (error) {
            throw error;
        }
    }

    static async checkExistingEmail(email) {
        const query = 'SELECT id FROM USER WHERE email = ?';
        const result = await conexion.query(query, [email]);
        if (result.data[0]) {
            throw new Error('El email ya está registrado');
        }
    }

    static async validatePassword(user, password) {
        return await bcrypt.compare(password, user.password);
    }

    static async update(id, userData) {
        try {
            await conexion.query('START TRANSACTION');

            try {
                // Si se proporciona una nueva contraseña, encriptarla
                if (userData.password) {
                    const salt = await bcrypt.genSalt(10);
                    userData.password = await bcrypt.hash(userData.password, salt);
                }

                // Si se proporciona una nueva ciudad, obtener o crear su ID
                let cityId;
                if (userData.city) {
                    const cityResult = await conexion.query('SELECT id FROM CITY WHERE name = ?', [userData.city]);
                    if (cityResult.data[0]) {
                        cityId = cityResult.data[0].id;
                    } else {
                        const newCityResult = await conexion.query('INSERT INTO CITY (name) VALUES (?)', [userData.city]);
                        cityId = newCityResult.data.insertId;
                    }
                    userData.city_id = cityId;
                    delete userData.city;
                }

                // Actualizar usuario
                const updateFields = Object.keys(userData)
                    .filter(key => userData[key] !== undefined)
                    .map(key => `${key} = ?`);
                
                const query = `UPDATE USER SET ${updateFields.join(', ')} WHERE id = ?`;
                const values = [...Object.values(userData).filter(value => value !== undefined), id];
                
                await conexion.query(query, values);

                await conexion.query('COMMIT');
                return await this.findById(id);
            } catch (error) {
                await conexion.query('ROLLBACK');
                throw error;
            }
        } catch (error) {
            throw error;
        }
    }

    static async delete(id) {
        try {
            await conexion.query('START TRANSACTION');
            
            try {
                // Primero eliminar el registro de camper
                await conexion.query('DELETE FROM CAMPER WHERE user_id = ?', [id]);
                
                // Luego eliminar el usuario
                await conexion.query('DELETE FROM USER WHERE id = ?', [id]);
                
                await conexion.query('COMMIT');
                return true;
            } catch (error) {
                await conexion.query('ROLLBACK');
                throw error;
            }
        } catch (error) {
            throw error;
        }
    }
}

module.exports = UserModel;
