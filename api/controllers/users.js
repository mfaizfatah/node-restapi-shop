const nodemailer = require('nodemailer');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { uuid } = require('uuidv4');
var Base64 = require('js-base64').Base64;

const logger = require('../utils/logger');
const User = require('../models/user');
const Redis = require('../adapter/redis');
const { use } = require('../routes/user');
const { json } = require('body-parser');

const asiaTime = new Date().toLocaleString("en-US", {timeZone: "Asia/Jakarta"});

var transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'mfaizfatah2@gmail.com',
      pass: 'barbossa97'
    }
  });
  
exports.sendEmail = (req, res, next) => {
    const email = req.body.email 
    transporter.sendMail({
        from: 'mfaizfatah2@gmail.com',
        to: email,
        subject: 'Sending Email using Node.js',
        text: 'That was easy!'
    }, function(error, info){
        if (error) {
          console.log(error);
          res.status(500).json({
              message: "Failed send email"
          })
        } else {
          console.log('Email sent: ' + info.response);
          res.status(200).json({
              message: "Email was sent" + info.response
          })
        }
    });
};

exports.user_signup = (req, res, next) => {
  var where = {email: req.body.email}
  User.find(where, (err, docs) => {
    if (err) {
      res.status(500).json({
          error: err
      })
      return
    }

    if (docs.length >= 1) {
      return res.status(409).json({
        message: 'Mail exists'
      })
    } else {
      bcrypt.hash(req.body.password, 10, (err, hash) => {
        if (err) {
          return res.status(500).json({
            error: err
          })
        } else {
          console.log(req.body.namaLengkap)
          var namaLengkap = req.body.namaLengkap
          if (namaLengkap == undefined || namaLengkap == "") {
           namaLengkap = req.body.username
          }
          const user = new User({
            _id: mongoose.Types.ObjectId(),
            email: req.body.email,
            password: hash,
            username: req.body.username,
            namaLengkap: namaLengkap,
            namaPanggilan: req.body.namaPanggilan,
            jenisKelamin: req.body.jenisKelamin,
            kelas: req.body.kelas,
            provinsi: req.body.provinsi,
            kota: req.body.kota,
            sekolah: req.body.sekolah,
            created_at: new Date(asiaTime),
            updated_at: new Date(asiaTime)
          })
          user.save((err, data) => {
            if (err) {
              return res.status(500).json({
                  error: err
              })
            }
            res.status(201).json({
              message: 'user created'
            })
          })
        }
      })
    }
  })   
}

exports.user_login = (req, res, next) => {
  var where = {}
  if (req.body.email) {
    where = {email: req.body.email}
  } else if (req.body.username) {
    where = {username: req.body.username}
  } else {
    return res.status(400).json({
      message: 'email or username not found'
    })
  }
  
  User.find(where, (err, user) => {
    if (err) {
      return res.status(500).json({
        error: err
      })
    }
    if (user.length < 1) {
      return res.status(401).json({
        message: 'Auth failed'
      })
    }

    bcrypt.compare(req.body.password, user[0].password, (err, result) => {
      if (err) {
        return res.status(401).json({
          message: 'Auth failed'
        })
      }
      if (result) {
        const token = uuid()
        var obj = {
          id: user[0]._id,
          email: user[0].email,
          username: user[0].username
        }
        const value = Base64.encode(JSON.stringify(obj))
        const duration = process.env.TOKEN_DURATION
        var errorRedis = ""
        Redis.set(token, value, 'EX', parseInt(duration), (err, reply) => { 
          if (err) {
            errorRedis = err.message
          } 
        })
        if (errorRedis != "") {
          return res.status(500).json({
            error: errorRedis
          })
        }
        return res.status(200).json({
          message: 'Auth Successful',
          username: user[0].username,
          token: token,
          duration: process.env.TOKEN_DURATION
        })
      }
      res.status(401).json({
        message: 'Auth failed'
      })
    })

  })
}

exports.user_delete = (req, res, next) => {
  User.remove({_id:req.params.userId}, (err, result) => {
    if (err) {
      return res.status(500).json({
          error: err
      })
    }
    res.status(200).json({
      message: 'User deleted'
    })
  })
}

exports.user_get_one = (req, res, next) => {
  const where = {username: req.params.username}

  User.find(where, (err, data) => {
    if (err) {
      return res.status(500).json({
          error: err
      })
    }

    if (data) {
      res.status(200).json(data)
    } else {
      res.status(404).json({
        message: 'No valid entry found for provicded ID'
      })
    }
  })
}

exports.user_refresh_token = (req, res, next) => {
  const token = req.body.token;
  Redis.get(token, (err, reply) => {
      if (err || !reply) {
          return res.status(500).json({
              message: 'Something Error'
          })
      } else {
          var errorRedis = ""
          Redis.set(token, reply.toString(), 'EX', parseInt(process.env.TOKEN_DURATION), (err, data) => {
              if (err) {
                  console.log(err)
                  errorRedis = err.message
              }
          })
          if (errorRedis != "") {
            return res.status(500).json({
              message: 'Something Error'
          })
          }
          var decode = Base64.decode(reply.toString())
          req.userData = JSON.parse(decode)
          res.status(200).json({
            message: 'Token Refreshed'
          })  
        }
      })
}

exports.user_update_user = (req, res, next) => {
  const username = req.params.username
  const { namaLengkap, namaPanggilan, jenisKelamin, kelas, provinsi, kota, sekolah } = req.body
  const where = {username: username}
  
  User.find(where, (err, data) => {
    var st = false
    if (err) {
      return res.status(500).json({
          error: err
      })
    }

    if (!data) {
      return res.status(404).json({
        message: 'No valid entry found for provicded ID'
      })
    } else {
      st = true
    }

    if (st) {
      User.findById(data[0]._id, (err, result) => {
        if (err || !result) {
          return res.status(500).json({
            message: "Something Error"
          })
        }
        result.namaLengkap = namaLengkap
        result.namaPanggilan = namaPanggilan
        result.jenisKelamin = jenisKelamin
        result.kelas = kelas
        result.provinsi = provinsi
        result.kota = kota
        result.sekolah = sekolah
        result.updated_at = new Date(asiaTime)  
        console.log(result)
        result.save((err, reply) => {
          if (err) {
            return res.status(500).json({
              message: "Error while updating data. Please try again later. Thank You!"
            })
          }
          res.status(200).json({
            message: 'User Updated'
          })
        })
      })
    } else {
      res.status(404).json({
        message: 'No valid entry found for provicded ID'
      })
    }

  })
}