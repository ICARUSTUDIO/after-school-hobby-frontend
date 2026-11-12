// address of my server on render
const API = 'https://m01136849-after-school-hobby-backend.onrender.com'

const myApp = Vue.createApp({
    data() {
        return {
            siteName: 'Extra Lessons',
            showLessons: true,
            loading: true,
            sending: false,
            sortBy: 'topic',
            sortOrder: 'asc',
            openLesson: null,
            search: '',
            teacherId: '',
            name: '',
            phone: '',
            orderMessage: '',
            errorMessage: '',
            lessons: [],
            teachers: [],
            enrolment: {},
            cart: []
        }
    },
    // runs when the page first loads
    created() {
        this.getLessons()
        this.getTeachers()
    },
    methods: {
        // GET all lessons
        getLessons() {
            this.loading = true
            fetch(API + '/lessons')
                .then(response => response.json())
                .then(data => {
                    this.lessons = data
                    this.loading = false
                })
                .catch(() => {
                    this.errorMessage = 'Could not load the lessons, is the server running?'
                    this.loading = false
                })
        },
        // GET all teachers for the dropdown
        getTeachers() {
            fetch(API + '/teachers')
                .then(response => response.json())
                .then(data => {
                    this.teachers = data
                })
        },
        // the search is done on the server, this just sends what was typed
        searchLessons() {
            this.teacherId = ''
            fetch(API + '/search?q=' + this.search)
                .then(response => response.json())
                .then(data => {
                    this.lessons = data
                })
        },
        // show only the lessons of the chosen teacher
        pickTeacher() {
            this.search = ''
            if (this.teacherId == '') {
                this.getLessons()
                return
            }
            fetch(API + '/teachers/' + this.teacherId + '/lessons')
                .then(response => response.json())
                .then(data => {
                    this.lessons = data
                })
        },
        // find which teacher teaches this lesson
        teacherName(lesson) {
            for (let teacher of this.teachers) {
                if (teacher.lessonIds.includes(lesson._id)) {
                    return teacher.firstName + ' ' + teacher.lastName
                }
            }
            return ''
        },
        // how many of this lesson are in the cart
        countInCart(lesson) {
            return this.cart.filter(item => item._id == lesson._id).length
        },
        // spaces in the database minus the ones in the cart
        spacesLeft(lesson) {
            return lesson.space - this.countInCart(lesson)
        },
        addToCart(lesson) {
            if (this.spacesLeft(lesson) > 0) {
                this.cart.push(lesson)
                this.orderMessage = ''
            }
        },
        removeFromCart(index) {
            this.cart.splice(index, 1)
            if (this.cart.length == 0) {
                this.showLessons = true
            }
        },
        toggleCart() {
            this.showLessons = !this.showLessons
        },
        // open a lesson's details, or close them if they're already open
        toggleDetails(id) {
            if (this.openLesson == id) {
                this.openLesson = null
            } else {
                this.openLesson = id
                this.getEnrolment(id)
            }
        },
        // GET how many spaces have been bought for a lesson
        getEnrolment(id) {
            fetch(API + '/enrolment/' + id)
                .then(response => response.json())
                .then(data => {
                    this.enrolment[id] = data.enrolment
                })
        },
        checkout() {
            this.sending = true
            this.errorMessage = ''

            // list each lesson in the cart only once
            let lessonsInCart = []
            for (let lesson of this.cart) {
                if (!lessonsInCart.find(item => item._id == lesson._id)) {
                    lessonsInCart.push(lesson)
                }
            }

            let order = {
                name: this.name,
                phone: this.phone,
                lessons: lessonsInCart.map(lesson => ({
                    lessonId: lesson._id,
                    topic: lesson.topic,
                    spaces: this.countInCart(lesson)
                })),
                totalSpaces: this.cart.length,
                totalPrice: this.cartTotal
            }

            // 1. POST the order
            fetch(API + '/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(order)
            })
                .then(() => {
                    // 2. PUT the new spaces for each lesson that was bought
                    let updates = lessonsInCart.map(lesson =>
                        fetch(API + '/lessons/' + lesson._id, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ space: this.spacesLeft(lesson) })
                        })
                    )
                    return Promise.all(updates)
                })
                .then(() => {
                    // 3. show the message and reset everything
                    this.orderMessage = 'Thank you ' + this.name + ', your order has been submitted!'
                    this.cart = []
                    this.name = ''
                    this.phone = ''
                    this.search = ''
                    this.teacherId = ''
                    this.enrolment = {}
                    this.showLessons = true
                    this.sending = false
                    this.getLessons()
                })
                .catch(() => {
                    this.errorMessage = 'Something went wrong sending your order, please try again.'
                    this.sending = false
                })
        },
        // colour of the spaces badge
        spaceColour(space) {
            if (space == 0) return 'none-left'
            if (space <= 2) return 'few-left'
            return 'lots-left'
        }
    },
    computed: {
        sortedLessons() {
            let list = this.lessons.slice()

            list.sort((a, b) => {
                let first = a[this.sortBy]
                let second = b[this.sortBy]

                // for spaces, sort by what's left after the cart
                if (this.sortBy == 'space') {
                    first = this.spacesLeft(a)
                    second = this.spacesLeft(b)
                }

                // so "art" and "Art" sort the same
                if (typeof first == 'string') {
                    first = first.toLowerCase()
                    second = second.toLowerCase()
                }

                if (first < second) return this.sortOrder == 'asc' ? -1 : 1
                if (first > second) return this.sortOrder == 'asc' ? 1 : -1
                return 0
            })

            return list
        },
        cartTotal() {
            let total = 0
            for (let lesson of this.cart) {
                total += lesson.price
            }
            return total
        },
        // letters and spaces only
        nameValid() {
            return /^[A-Za-z ]+$/.test(this.name) && this.name.trim() != ''
        },
        // numbers only
        phoneValid() {
            return /^[0-9]+$/.test(this.phone)
        }
    }
})

myApp.mount('#app')