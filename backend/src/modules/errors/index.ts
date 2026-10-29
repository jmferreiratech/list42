import {getReasonPhrase, StatusCodes} from 'http-status-codes';
import {inspect} from 'util';

export class ApplicationError extends Error {
    readonly status;

    constructor(status: typeof StatusCodes[keyof typeof StatusCodes], message: string) {
        super(message);
        this.status = status;
    }

    toJSON() {
        return {
            type: 'about:blank',
            title: getReasonPhrase(this.status),
            status: this.status,
            detail: this.message || undefined,
        };
    }
}

export class ServerError extends ApplicationError {
    readonly _original;

    constructor(status: number, message: string, _original?: Error) {
        super(status, message);
        this._original = _original;
    }

    override toJSON() {
        return {
            ...(super.toJSON()),
            detail: undefined,
        };
    }

    [Symbol.for('nodejs.util.inspect.custom')]() {
        return `${this.constructor.name} ${JSON.stringify({
            ...super.toJSON(),
            original: this._original && inspect(this._original),
        }, null, 2)}`;
    }
}

export class ValidationError extends ApplicationError {
    private details: unknown[];

    constructor(
        message: string,
        details: unknown[] = [],
    ) {
        super(StatusCodes.BAD_REQUEST, message);
        this.details = details;
    }

    override toJSON() {
        return {
            ...super.toJSON(),
            validation_details: this.details,
        };
    }
}

export class NotFoundError extends ApplicationError {
    constructor(message = 'Recurso não encontrado') {
        super(StatusCodes.NOT_FOUND, message);
    }
}

export class InternalError extends ServerError {
    constructor(message = 'Erro interno', original?: Error) {
        super(StatusCodes.INTERNAL_SERVER_ERROR, message, original);
    }
}

export class ForbiddenError extends ApplicationError {
    constructor(message = 'Não autorizado') {
        super(StatusCodes.FORBIDDEN, message);
    }
}

export class BadRequestError extends ApplicationError {
    constructor(message = 'Bad request') {
        super(StatusCodes.BAD_REQUEST, message);
    }
}

export class UnauthorizedError extends ApplicationError {
    constructor(message = 'Não autorizado') {
        super(StatusCodes.UNAUTHORIZED, message);
    }
}

export class ConflictError extends ApplicationError {
    constructor(message = 'Conflito') {
        super(StatusCodes.CONFLICT, message);
    }
}
