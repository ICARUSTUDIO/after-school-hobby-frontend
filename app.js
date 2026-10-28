// if the page is opened on my own machine use the local server,
// otherwise (on github pages) use the one hosted on render
// TODO: put your student number in the render link
const local = location.hostname == 'localhost' || location.hostname == '127.0.0.1' || location.hostname == ''
const API = local ? 'http://localhost:3000' : 'https://m01136849-after-school-hobby-backend.onrender.com'

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
    created() {
        this.getLessons()
        this.getTeachers()
    },
    methods: {
        // GET all the lessons from the server
        getLessons() {
            this.loading = true
            fetch(API + '/lessons')
                .then(response => response.json())
                .then(data => {
                    this.lessons = data
                    this.loading = false
                })
                .catch(error => {
                    console.log(error)
                    this.errorMessage = 'Could not load the lessons, is the server running?'
                    this.loading = false
                })
        },
        getTeachers() {
            fetch(API + '/teachers')
                .then(response => response.json())
                .then(data => {
                    this.teachers = data
                })
                .catch(error => console.log(error))
        },
        // runs every time something is typed in the search box
        searchLessons() {
            this.teacherId = ''
            let typed = this.search

            fetch(API + '/search?q=' + encodeURIComponent(typed))
                .then(response => response.json())
                .then(data => {
                    // only use the results if the user hasn't typed something newer
                    if (typed == this.search) {
                        this.lessons = data
                    }
                })
                .catch(error => console.log(error))
        },
        // show only the lessons from the chosen teacher
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
                .catch(error => console.log(error))
        },
        teacherName(lesson) {
            for (let teacher of this.teachers) {
                if (teacher.lessonIds.includes(lesson._id)) {
                    return teacher.firstName + ' ' + teacher.lastName
                }
            }
            return ''
        },
        // spaces from the database minus the ones already in the cart
        spacesLeft(lesson) {
            let inCart = this.cart.filter(item => item._id == lesson._id).length
            return lesson.space - inCart
        },
        addToCart(lesson) {
            if (this.spacesLeft(lesson) > 0) {
                this.cart.push(lesson)
                this.orderMessage = ''
            }
        },
        // taking it out of the cart gives the space back automatically
        removeFromCart(index) {
            this.cart.splice(index, 1)

            // cart is empty so go back to lessons
            if (this.cart.length == 0) {
                this.showLessons = true
            }
        },
        toggleCart() {
            this.showLessons = this.showLessons ? false : true
        },
        // if this lesson is already open close it, if not open it
        toggleDetails(id) {
            if (this.openLesson == id) {
                this.openLesson = null
            } else {
                this.openLesson = id
                this.getEnrolment(id)
            }
        },
        // how many people have already bought this lesson
        getEnrolment(id) {
            fetch(API + '/enrolment/' + id)
                .then(response => response.json())
                .then(data => {
                    this.enrolment[id] = data.enrolment
                })
                .catch(error => console.log(error))
        },
        checkout() {
            this.sending = true
            this.errorMessage = ''

            // group the cart so each lesson only appears once with how many spaces
            let orderLessons = []
            for (let lesson of this.cart) {
                let found = orderLessons.find(item => item.lessonId == lesson._id)
                if (found) {
                    found.spaces++
                } else {
                    orderLessons.push({ lessonId: lesson._id, topic: lesson.topic, spaces: 1, oldSpace: lesson.space })
                }
            }

            let order = {
                name: this.name,
                phone: this.phone,
                lessons: orderLessons.map(item => ({ lessonId: item.lessonId, topic: item.topic, spaces: item.spaces })),
                totalSpaces: this.cart.length,
                totalPrice: this.cartTotal
            }

            // 1. POST the order
            fetch(API + '/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(order)
            })
                .then(response => response.json())
                .then(() => {
                    // 2. PUT the new number of spaces for every lesson in the order
                    let updates = orderLessons.map(item => {
                        return fetch(API + '/lessons/' + item.lessonId, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ space: item.oldSpace - item.spaces })
                        })
                    })
                    return Promise.all(updates)
                })
                .then(() => {
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
                .catch(error => {
                    console.log(error)
                    this.errorMessage = 'Something went wrong sending your order, please try again.'
                    this.sending = false
                })
        },
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

                // sort by what's actually left, not what's in the database
                if (this.sortBy == 'space') {
                    first = this.spacesLeft(a)
                    second = this.spacesLeft(b)
                }

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
