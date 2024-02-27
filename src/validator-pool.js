class ValidatorPool {

    #maxSize;
    #factory;
    #name;
    #createCount = 0;
    #pool = [];

    constructor(maxSize, factory, name = '') {
        this.#maxSize = maxSize;
        this.#factory = factory;
        this.#name = name; // for debugging
    }

    get() {
        if (this.#pool.length > 0) {
            return this.#pool.pop();
        }
        this.#createCount++;
        return this.#factory(`${this.#name}-${this.#createCount}`); // return a new instance
    }

    return(instance) {
        if (this.#pool.length < this.#maxSize) {
            this.#pool.push(instance);
        }
        //console.log(`pool size: ${this.#name} ` + this.#pool.length)
    }
}

export { ValidatorPool };