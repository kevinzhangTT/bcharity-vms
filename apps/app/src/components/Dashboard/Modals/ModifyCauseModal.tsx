import { ProfileFragment as Profile } from '@lens-protocol/client'
import { Erc20Fragment } from '@lens-protocol/client'
import { useStorageUpload } from '@thirdweb-dev/react'
import React, { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import FormDropdown from '@/components/Shared/FormDropdown'
import GradientModal from '@/components/Shared/Modal/GradientModal'
import { Form } from '@/components/UI/Form'
import { Input } from '@/components/UI/Input'
import LocationFormComponent from '@/components/UI/LocationDropdowns'
import { Spinner } from '@/components/UI/Spinner'
import { TextArea } from '@/components/UI/TextArea'
import getTokenImage from '@/lib/getTokenImage'
import checkAuth from '@/lib/lens-protocol/checkAuth'
import useCreatePost from '@/lib/lens-protocol/useCreatePost'
import { buildMetadata, CauseMetadataRecord } from '@/lib/metadata'
import { PostTags } from '@/lib/metadata'
import { MetadataVersion } from '@/lib/types'

import Error from './Error'
import { IPublishCauseFormProps } from './PublishCauseModal'

interface IPublishCauseModalProps {
  open: boolean
  onClose: (shouldRefetch: boolean) => void
  id: string
  publisher: Profile | null
  defaultValues: IPublishCauseFormProps
  currencyData: Erc20Fragment[] | undefined
}

const ModifyCauseModal: React.FC<IPublishCauseModalProps> = ({
  open,
  onClose,
  id,
  publisher,
  defaultValues,
  currencyData
}) => {
  const { createPost } = useCreatePost()

  const form = useForm<IPublishCauseFormProps>({ defaultValues })

  const {
    handleSubmit,
    reset,
    register,
    watch,
    clearErrors,
    formState: { errors }
  } = form

  const { mutateAsync: upload } = useStorageUpload()

  const { t } = useTranslation('common')

  const [isPending, setIsPending] = useState<boolean>(false)
  const [error, setError] = useState<boolean>(false)
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [image, setImage] = useState<File | null>(null)

  const currency = watch('currency')

  const [selectedCurrencySymbol, setSelectedCurrencySymol] = useState('WMATIC')

  useEffect(() => {
    reset(defaultValues)
  }, [defaultValues, reset])

  useEffect(() => {
    setSelectedCurrencySymol(
      currencyData?.find((c) => c.address === currency)?.symbol ?? 'WMATIC'
    )
  }, [currency, currencyData])

  const onCancel = () => {
    clearErrors()
    reset(defaultValues)
    onClose(false)
  }

  const onSubmit = async (formData: IPublishCauseFormProps) => {
    setError(false)
    setIsPending(true)

    if (!publisher) {
      setErrorMessage('No publisher provided')
      setError(true)
      setIsPending(false)
      return
    }

    const imageUrl = image
      ? (await upload({ data: [image] }))[0]
      : defaultValues.imageUrl

    const metadata = buildMetadata<CauseMetadataRecord>(
      publisher,
      [PostTags.OrgPublish.Cause],
      {
        version: MetadataVersion.CauseMetadataVersion['1.0.1'],
        type: PostTags.OrgPublish.Cause,
        id,
        name: formData.name,
        category: formData.category,
        currency: formData.currency,
        contribution: formData.contribution,
        goal: formData.goal,
        recipient: formData.recipient,
        description: formData.description,
        location: `${formData.country}-${formData.province}-${formData.city}`,
        imageUrl
      }
    )

    const collectModuleParams = {
      feeCollectModule: {
        amount: {
          currency,
          value: formData.contribution
        },
        recipient: formData.recipient,
        referralFee: 0,
        followerOnly: false
      }
    }

    checkAuth(publisher.ownedBy)
      .then(() =>
        createPost(publisher, metadata, collectModuleParams, {
          followerOnlyReferenceModule: false
        })
      )
      .then((res) => {
        if (res.isFailure()) {
          setError(true)
          setErrorMessage(res.error.message)
          throw res.error.message
        }
      })
      .then(() => {
        reset(formData)
        onClose(true)
      })
      .catch((e) => {
        setErrorMessage(e.message)
        setError(true)
      })
      .finally(() => {
        setIsPending(false)
      })
  }

  return (
    <GradientModal
      title={'Modify Project'}
      open={open}
      onCancel={onCancel}
      onSubmit={handleSubmit((data) => onSubmit(data))}
      submitDisabled={isPending}
    >
      <div className="mx-12">
        {!isPending ? (
          <Form
            form={form}
            onSubmit={() => handleSubmit((data) => onSubmit(data))}
          >
            <Input
              label="Project name"
              placeholder="Medical internship"
              error={!!errors.name?.type}
              {...register('name', {
                required: true,
                maxLength: 255
              })}
            />
            <Input
              label="Category"
              placeholder="Healthcare"
              error={!!errors.category?.type}
              {...register('category', {
                required: true,
                maxLength: 40
              })}
            />
            <FormDropdown
              label={t('Select currency')}
              options={currencyData?.map((c) => c.address) ?? []}
              displayedOptions={currencyData?.map((c) => c.name) ?? []}
              {...register('currency')}
            />
            <LocationFormComponent
              defaultCountry={defaultValues.country}
              defaultProvince={defaultValues.province}
              defaultCity={defaultValues.city}
            />
            <Input
              label={t('Contribution')}
              type="number"
              step="0.0001"
              min="0"
              max="100000"
              prefix={
                <img
                  className="w-6 h-6"
                  height={24}
                  width={24}
                  src={getTokenImage(selectedCurrencySymbol)}
                  alt={selectedCurrencySymbol}
                />
              }
              placeholder="5"
              {...register('contribution', {
                required: true,
                min: {
                  value: 1,
                  message: 'Invalid amount'
                }
              })}
            />
            <Input
              label={t('Funding goal')}
              type="number"
              step="0.0001"
              min="0"
              max="100000"
              prefix={
                <img
                  className="w-6 h-6"
                  height={24}
                  width={24}
                  src={getTokenImage(selectedCurrencySymbol)}
                  alt={selectedCurrencySymbol}
                />
              }
              placeholder="400"
              {...register('goal', { required: true })}
            />
            <Input
              label={t('Recipient')}
              type="text"
              placeholder="0x3A5bd...5e3"
              {...register('recipient', {
                required: true,
                pattern: {
                  value: /^0x[a-fA-F0-9]{40}$/,
                  message: 'Invalid Ethereum address'
                }
              })}
            />
            <TextArea
              label="Description"
              placeholder="Tell us more about this project"
              error={!!errors.description?.type}
              {...register('description', { required: true, maxLength: 1000 })}
            />
            <Input
              label="Image (optional): "
              type="file"
              onChange={(e) => setImage(e.target.files?.[0] || null)}
            />
          </Form>
        ) : (
          <Spinner />
        )}

        {error && (
          <Error
            message={`An error occured: ${errorMessage}. Please try again.`}
          />
        )}
      </div>
    </GradientModal>
  )
}

export default ModifyCauseModal
