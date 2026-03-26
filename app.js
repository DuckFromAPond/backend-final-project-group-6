const express = require('express')
const { engine } = require('express-handlebars')
require('dotenv').config()

const PORT = process.env.PORT || 3000

const app = express()

// configurations for app
app.engine('handlebars', engine({
    defaultLayout: 'main',
    partialsDir: __dirname + '/views/partials',
    helpers: {
        section: function (name, options) {
            if (!this._sections) this._sections = {}
            this._sections[name] = options.fn(this)
            return null
        },
        ifContains: function (container, stringToFind, options) {
            if (container && container.includes(stringToFind)) {
                return options.fn(this)
            }
            return options.inverse(this)
        }
    }
}))
app.set('view engine', 'handlebars')
app.set('views', __dirname + '/views')

// middleware
app.use(express.static(__dirname + '/public'))

const itemData = {
    categories: [
        { name: 'Computers', subCategories: []},
        { name: 'Peripherals', subCategories: []},
    ],
    //Fields: Item ID (Unique), Serial Number, Model, Brand, Category, Status (Available, In-Use, Maintenance, Retired), and Date Acquired.
    items: [
        { id: 1, name: 'item 1', serial: 'serial 1', model: 'model 1', brand: 'brand 1', category: 'Computers', status: 'Available', dateAcquired: '2022-01-01', description: 'item 1 description', imagePath: '/images/placeholder.jpg', imageAlt: 'item 1 image' },
        { id: 2, name: 'item 2', serial: 'serial 2', model: 'model 2', brand: 'brand 2', category: 'Computers', status: 'In-Use', dateAcquired: '2022-02-02', description: 'item 2 description', imagePath: '/images/placeholder.jpg', imageAlt: 'item 2 image' },
        { id: 3, name: 'item 3', serial: 'serial 3', model: 'model 3', brand: 'brand 3', category: 'Peripherals', status: 'Maintenance', dateAcquired: '2022-03-03', description: 'item 3 description', imagePath: '/images/placeholder.jpg', imageAlt: 'item 3 image' }
    ],
    itemHistories: [
        {
            id: 1,
            histories: [
                { assignee: 'assignee 1', duration: 'duration 1', referenceLink: 'reference link 1' }
            ]
        },
        {
            id: 2,
            histories: [
                { assignee: 'assignee 2', duration: 'duration 2', referenceLink: 'reference link 2' }
            ]
        },
        {
            id: 3,
            histories: [
                { assignee: 'assignee 3', duration: 'duration 3', referenceLink: 'reference link 3' }
            ]
        }
    ]
}

// routes
app.get('/items', (req, res) => {
    const { cat } = req.query

    let context = itemData

    if(itemData.categories.find(category => category.name === cat)) {
        context = {
            categories: itemData.categories,
            items: itemData.items.filter(item => item.category === cat)
        }
    }

    res.render('items', context)
})

app.get('/items/:id/history', (req, res) => {
    const { id } = req.params

    const context = {
        item: itemData.items.find(item => String(item.id) === String(id)),
        itemHistories: itemData.itemHistories.find(item => String(item.id) === String(id))
    }

    res.render('itemHistory', context)
})

app.get('/items/:id', (req, res) => {
    const { id } = req.params

    const context = itemData.items.find(item => String(item.id) === String(id))

    if (!context) {
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

app.listen(PORT, () => {
    console.log('Server started on port 3000')
})