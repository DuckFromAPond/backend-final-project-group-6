const express = require('express')
const {engine} = require('express-handlebars')
require('dotenv').config()

const PORT = process.env.PORT || 3000

const app = express()

// configurations for app
app.engine('handlebars', engine({
    defaultLayout: 'main',
    partialsDir: __dirname + '/views/partials',
    helpers: {
        section: function(name, options) {
            if(!this._sections) this._sections = {}
            this._sections[name] = options.fn(this)
            return null
        }
    }
}))
app.set('view engine', 'handlebars')
app.set('views', __dirname + '/views')

// middleware
app.use(express.static(__dirname + '/public'))

const itemData = {
    categories: [
        {id: 1, name: 'category1'},
        {id: 2, name: 'category2'},
        {id: 3, name: 'category3'}
    ],
    items: [
        {id: 1, name: 'item 1', description: 'item 1 description', imagePath: '/images/placeholder.jpg', imageAlt: 'item 1 image'},
        {id: 2, name: 'item 2', description: 'item 2 description', imagePath: '/images/placeholder.jpg', imageAlt: 'item 2 image'},
        {id: 3, name: 'item 3', description: 'item 3 description', imagePath: '/images/placeholder.jpg', imageAlt: 'item 3 image'}
    ]
}

// routes
app.get('/items', (req, res) => {
    const context = itemData

    res.render('items', context)
})

app.get('/items/:id/history', (req, res) => {
    res.render('itemHistory')
})

app.get('/items/:id', (req, res) => {
    const {id} = req.params

    const context = itemData.items.find(item => String(item.id) === String(id))

    if(!context) {
        res.status(404)
        return res.render('404')
    }

    res.render('itemDetail', context)
})

app.use((req, res, next) => {
    res.status(404)
    res.render('404')
})

app.use((error, req, res, next) => {
    res.status(500)
    res.render('500')
})

app.listen(PORT, ()=> {
    console.log('Server started on port 3000')
})