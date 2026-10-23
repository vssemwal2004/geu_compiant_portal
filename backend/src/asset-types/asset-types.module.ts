import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AssetType, AssetTypeSchema } from './asset-type.schema';
import { AssetTypesController } from './asset-types.controller';
import { AssetTypesService } from './asset-types.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: AssetType.name, schema: AssetTypeSchema }])],
  controllers: [AssetTypesController],
  providers: [AssetTypesService],
  exports: [AssetTypesService],
})
export class AssetTypesModule {}
