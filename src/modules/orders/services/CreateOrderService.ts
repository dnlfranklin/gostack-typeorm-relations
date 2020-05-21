import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('Customer does not exists');
    }

    const productsRepo = await this.productsRepository.findAllById(products);

    const newProductsQuantity: IProduct[] = [];

    const productsOrders = products.map(product => {
      const { id, quantity } = product;

      const productExists = productsRepo.find(repo => repo.id === id);

      if (!productExists) {
        throw new AppError(`Product ${product.id} does not exists`);
      }

      if (productExists.quantity < quantity) {
        throw new AppError(
          `Product ${product.id} does not have sufficient supply`,
        );
      }

      const newQuantity = productExists.quantity - quantity;

      newProductsQuantity.push({
        id,
        quantity: newQuantity,
      });

      return {
        product_id: id,
        quantity,
        price: productExists.price,
      };
    });

    const orders = await this.ordersRepository.create({
      customer,
      products: productsOrders,
    });

    await this.productsRepository.updateQuantity(newProductsQuantity);

    return orders;
  }
}

export default CreateOrderService;
